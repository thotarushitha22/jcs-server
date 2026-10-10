const { Order, OrderItem } = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");

// Adds title / price / image to every order item so the frontend can show
// the real product name and price (instead of "Product Item" and ₹0).
const withItemDetails = (order) => {
    const plain = order && typeof order.toJSON === "function" ? order.toJSON() : order;
    if (!plain) return plain;
    plain.items = (plain.items || []).map((item) => {
        const product = item.product || {};
        const images = Array.isArray(product.images) ? product.images : [];
        return {
            ...item,
            title: product.title || item.title || "Product",
            name: product.title || item.title || "Product",
            price: Number(item.priceAtPurchase ?? product.price ?? 0),
            image: images[0] || product.image || null,
        };
    });
    return plain;
};

// The database accepts only three payment methods: upi | credit | cod.
// The shop front end sends readable labels ("Razorpay Test", "Cash on Delivery",
// "Credit Terms"), so they are converted here instead of being rejected.
const normalizePaymentMethod = (value) => {
    const method = String(value || "").toLowerCase();
    if (method.includes("cod") || method.includes("cash")) return "cod";
    if (method.includes("credit terms") || method === "credit") return "credit";
    return "upi"; // upi, card, netbanking, razorpay ...
};

// POST /api/orders  (logged-in buyer)
exports.createOrder = async (req, res) => {
    try {
        const { items, shippingName, shippingGstin, shippingAddress, shippingCity, shippingPincode, shippingPhone, paymentMethod } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "Order must include at least one item" });
        }

        // Each line needs the product id and the quantity.
        // (productId is the expected name; "product" and "id" are accepted too.)
        const lines = items.map((item) => ({
            productId: item.productId ?? item.product ?? item.id,
            qty: Number(item.qty ?? item.quantity ?? 1),
        }));

        if (lines.some((line) => line.productId === undefined || line.productId === null || line.productId === "")) {
            return res.status(400).json({
                message: "Every item must include a productId",
            });
        }

        const products = await Product.findAll({ where: { id: lines.map((l) => l.productId) } });
        const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

        let subtotal = 0;
        const orderItemsData = lines.map(({ productId, qty }) => {
            const product = productMap[productId];
            if (!product) throw new Error(`Product ${productId} not found`);
            subtotal += Number(product.price) * qty;
            return { productId, qty, priceAtPurchase: product.price };
        });

        const gstAmount = Math.round(subtotal * 0.18);
        const totalAmount = subtotal + gstAmount;

        // UPI/Cards/Netbanking is treated as paid immediately (simulated gateway
        // confirmation happens client-side before this request is sent).
        // Credit terms and Cash on Delivery are settled later, so they stay "pending".
        const method = normalizePaymentMethod(paymentMethod);
        const paymentStatus = method === "upi" ? "paid" : "pending";

        const order = await Order.create({
            buyerId: req.user.id,
            totalAmount,
            gstAmount,
            shippingName,
            shippingGstin,
            shippingAddress,
            shippingCity,
            shippingPincode,
            shippingPhone,
            paymentMethod: method,
            paymentStatus,
        });

        await OrderItem.bulkCreate(orderItemsData.map((item) => ({ ...item, orderId: order.id })));

        const fullOrder = await Order.findByPk(order.id, {
            include: [{ model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] }],
        });

        res.status(201).json(withItemDetails(fullOrder));
    } catch (err) {
        console.error(err);
        res.status(400).json({ message: "Failed to create order", error: err.message });
    }
};

// GET /api/orders  (logged-in buyer's own orders)
exports.getMyOrders = async (req, res) => {
    try {
        const orders = await Order.findAll({
            where: { buyerId: req.user.id },
            include: [
                { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] },
                { model: User, as: "buyer", attributes: ["id", "name", "email"] },
            ],
            order: [["createdAt", "DESC"]],
        });
        res.json(orders.map(withItemDetails));
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch orders", error: err.message });
    }
};

// GET /api/orders/all  (admin only — every order in the system)
exports.getAllOrders = async (req, res) => {
    try {
        const orders = await Order.findAll({
            include: [
                { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] },
                { model: User, as: "buyer", attributes: ["id", "name", "email"] },
            ],
            order: [["createdAt", "DESC"]],
        });
        res.json(orders.map(withItemDetails));
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch orders", error: err.message });
    }
};

// GET /api/orders/:id
exports.getOrder = async (req, res) => {
    try {
        const order = await Order.findOne({
            where: { id: req.params.id, buyerId: req.user.id },
            include: [
                { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] },
                { model: User, as: "buyer", attributes: ["id", "name", "email"] },
            ],
        });
        if (!order) return res.status(404).json({ message: "Order not found" });
        res.json(withItemDetails(order));
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch order", error: err.message });
    }
};

// PUT /api/orders/:id/status
//
// Admin    -> any of the 10 tracking stops (and cancel).
// Merchant -> only stops 1-4 (up to SHIPPED), and not once the order is shipped.
const ORDER_STATUSES = [
    "PENDING", "PAID", "PROCESSING", "SHIPPED",
    "HUB_1", "HUB_2", "HUB_3", "HUB_4",
    "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED",
];

const MERCHANT_STATUSES = ["PENDING", "PAID", "PROCESSING", "SHIPPED"];
const MERCHANT_LOCKED = [
    "SHIPPED", "HUB_1", "HUB_2", "HUB_3", "HUB_4",
    "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED",
];

exports.updateOrderStatus = async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id);
        if (!order) return res.status(404).json({ message: "Order not found" });

        const requested = String(req.body.status || "").toUpperCase();
        if (!ORDER_STATUSES.includes(requested)) {
            return res.status(400).json({ message: "Invalid order status" });
        }

        const role = String(req.user?.role || "").toLowerCase();

        if (role !== "admin") {
            if (!MERCHANT_STATUSES.includes(requested)) {
                return res.status(403).json({
                    message: "Merchants can only set stops up to Shipped",
                });
            }

            if (MERCHANT_LOCKED.includes(String(order.status || "").toUpperCase())) {
                return res.status(403).json({
                    message: "This order is already shipped. Further stops are handled by the admin.",
                });
            }
        }

        order.status = requested;
        await order.save();
        res.json(order);
    } catch (err) {
        res.status(400).json({ message: "Failed to update order", error: err.message });
    }
};