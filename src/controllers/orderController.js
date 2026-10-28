const { sequelize } = require("../config/db"); // Import Sequelize instance for transactions
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
const normalizePaymentMethod = (value) => {
    const method = String(value || "").toLowerCase();
    if (method.includes("cod") || method.includes("cash")) return "cod";
    if (method.includes("credit terms") || method === "credit") return "credit";
    return "upi";
};

// ==========================================
// POST /api/orders (logged-in buyer)
// ==========================================
exports.createOrder = async (req, res) => {
    // Start a transaction to handle stock deduction safely
    const transaction = await sequelize.transaction();

    try {
        const { items, shippingName, shippingGstin, shippingAddress, shippingCity, shippingPincode, shippingPhone, paymentMethod } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            await transaction.rollback();
            return res.status(400).json({ message: "Order must include at least one item" });
        }

        const lines = items.map((item) => ({
            productId: item.productId ?? item.product ?? item.id,
            qty: Number(item.qty ?? item.quantity ?? 1),
        }));

        if (lines.some((line) => line.productId === undefined || line.productId === null || line.productId === "")) {
            await transaction.rollback();
            return res.status(400).json({ message: "Every item must include a productId" });
        }

        // Fetch products WITH LOCK (prevents two people buying the last item at the same time)
        const products = await Product.findAll({
            where: { id: lines.map((l) => l.productId) },
            transaction,
            lock: true
        });
        const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

        let subtotal = 0;
        const orderItemsData = [];

        // Loop through items, check stock, and deduct
        for (const { productId, qty } of lines) {
            const product = productMap[productId];
            if (!product) {
                await transaction.rollback();
                return res.status(404).json({ message: `Product ${productId} not found` });
            }

            // CHECK STOCK
            if (product.stock < qty) {
                await transaction.rollback();
                return res.status(400).json({
                    message: `Sorry, ${product.title} only has ${product.stock} units left in stock.`
                });
            }

            // DEDUCT STOCK
            product.stock = product.stock - qty;
            await product.save({ transaction });

            subtotal += Number(product.price) * qty;
            orderItemsData.push({ productId, qty, priceAtPurchase: product.price });
        }

        const gstAmount = Math.round(subtotal * 0.18);
        const totalAmount = subtotal + gstAmount;

        const method = normalizePaymentMethod(paymentMethod);
        const paymentStatus = method === "upi" ? "paid" : "pending";

        // Create the Order
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
        }, { transaction });

        // Create Order Items
        await OrderItem.bulkCreate(orderItemsData.map((item) => ({ ...item, orderId: order.id })), { transaction });

        // Commit everything (Save to DB)
        await transaction.commit();

        const fullOrder = await Order.findByPk(order.id, {
            include: [{ model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] }],
        });

        res.status(201).json(withItemDetails(fullOrder));
    } catch (err) {
        await transaction.rollback();
        console.error("Order Error:", err);
        res.status(400).json({ message: "Failed to create order", error: err.message });
    }
};

// ==========================================
// GET /api/orders (logged-in buyer's own orders)
// ==========================================
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

// ==========================================
// GET /api/orders/all (admin only — every order in the system)
// ==========================================
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

// ==========================================
// GET /api/orders/:id
// ==========================================
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

// ==========================================
// PUT /api/orders/:id/status
// ==========================================
const ORDER_STATUSES = [
    "PENDING", "PAID", "PROCESSING", "SHIPPED",
    "HUB_1", "HUB_2", "HUB_3", "HUB_4",
    "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED",
];

// UPDATED: Added OUT_FOR_DELIVERY and DELIVERED so the delivery app can use this route
const MERCHANT_STATUSES = ["PENDING", "PAID", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];

const MERCHANT_LOCKED = [
    "DELIVERED", "CANCELLED", // They cannot change it once it's fully delivered or cancelled
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
            // Check if merchant is allowed to set this status
            if (!MERCHANT_STATUSES.includes(requested)) {
                return res.status(403).json({
                    message: "Merchants can only set stops up to Delivered",
                });
            }

            // Check if it's locked
            if (MERCHANT_LOCKED.includes(String(order.status || "").toUpperCase())) {
                return res.status(403).json({
                    message: "This order is already Delivered or Cancelled.",
                });
            }
        }

        // If the payment method is COD and it is delivered, mark paymentStatus as paid too
        if (requested === "DELIVERED" && order.paymentMethod === "cod") {
            order.paymentStatus = "paid";
        }

        order.status = requested;
        await order.save();
        res.json(order);
    } catch (err) {
        res.status(400).json({ message: "Failed to update order", error: err.message });
    }
};