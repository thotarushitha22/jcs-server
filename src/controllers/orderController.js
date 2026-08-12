const { Order, OrderItem } = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");

// POST /api/orders  (logged-in buyer)
exports.createOrder = async (req, res) => {
    try {
        const { items, shippingName, shippingGstin, shippingAddress, shippingCity, shippingPincode, shippingPhone, paymentMethod } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ message: "Order must include at least one item" });
        }

        const products = await Product.findAll({ where: { id: items.map((i) => i.productId) } });
        const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

        let subtotal = 0;
        const orderItemsData = items.map(({ productId, qty }) => {
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
        const method = paymentMethod || "upi";
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

        res.status(201).json(fullOrder);
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
            include: [{ model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] }],
            order: [["createdAt", "DESC"]],
        });
        res.json(orders);
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
        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch orders", error: err.message });
    }
};

// GET /api/orders/:id
exports.getOrder = async (req, res) => {
    try {
        const order = await Order.findOne({
            where: { id: req.params.id, buyerId: req.user.id },
            include: [{ model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] }],
        });
        if (!order) return res.status(404).json({ message: "Order not found" });
        res.json(order);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch order", error: err.message });
    }
};

// PUT /api/orders/:id/status  (admin only)
exports.updateOrderStatus = async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id);
        if (!order) return res.status(404).json({ message: "Order not found" });
        order.status = req.body.status;
        await order.save();
        res.json(order);
    } catch (err) {
        res.status(400).json({ message: "Failed to update order", error: err.message });
    }
};