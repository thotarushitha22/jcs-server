const { sequelize } = require("../config/db");
const { Order, OrderItem } = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");

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

const normalizePaymentMethod = (value) => {
    const method = String(value || "").toLowerCase();
    if (method.includes("cod") || method.includes("cash")) return "cod";
    if (method.includes("credit terms") || method === "credit") return "credit";
    return "upi";
};

exports.createOrder = async (req, res) => {
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

        const products = await Product.findAll({
            where: { id: lines.map((l) => l.productId) },
            transaction,
            lock: true
        });
        const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

        let subtotal = 0;
        const orderItemsData = [];

        for (const { productId, qty } of lines) {
            const product = productMap[productId];
            if (!product) {
                await transaction.rollback();
                return res.status(404).json({ message: `Product ${productId} not found` });
            }
            if (product.stock < qty) {
                await transaction.rollback();
                return res.status(400).json({ message: `Sorry, ${product.title} only has ${product.stock} units left in stock.` });
            }

            product.stock = product.stock - qty;
            await product.save({ transaction });

            subtotal += Number(product.price) * qty;
            orderItemsData.push({ productId, qty, priceAtPurchase: product.price });
        }

        const gstAmount = Math.round(subtotal * 0.18);
        const totalAmount = subtotal + gstAmount;
        const method = normalizePaymentMethod(paymentMethod);
        const paymentStatus = method === "upi" ? "paid" : "pending";

        const order = await Order.create({
            buyerId: req.user.id, totalAmount, gstAmount,
            shippingName, shippingGstin, shippingAddress, shippingCity, shippingPincode, shippingPhone,
            paymentMethod: method, paymentStatus,
        }, { transaction });

        await OrderItem.bulkCreate(orderItemsData.map((item) => ({ ...item, orderId: order.id })), { transaction });
        await transaction.commit();

        const fullOrder = await Order.findByPk(order.id, {
            include: [{ model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] }],
        });
        res.status(201).json(withItemDetails(fullOrder));
    } catch (err) {
        await transaction.rollback();
        res.status(400).json({ message: "Failed to create order", error: err.message });
    }
};

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

const ORDER_STATUSES = [
    "PENDING", "PAID", "PROCESSING", "SHIPPED",
    "HUB_1", "HUB_2", "HUB_3", "HUB_4",
    "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED",
];

const MERCHANT_STATUSES = ["PENDING", "PAID", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
const MERCHANT_LOCKED = ["DELIVERED", "CANCELLED"];

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
                return res.status(403).json({ message: "Merchants can only set stops up to Delivered" });
            }
            if (MERCHANT_LOCKED.includes(String(order.status || "").toUpperCase())) {
                return res.status(403).json({ message: "This order is already Delivered or Cancelled." });
            }
        }

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

exports.cancelOrder = async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id);
        if (!order) return res.status(404).json({ message: "Order not found" });

        if (order.buyerId !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ message: "You can only cancel your own orders." });
        }

        const lockedStatuses = ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];
        if (lockedStatuses.includes(String(order.status).toUpperCase())) {
            return res.status(400).json({ message: "This order cannot be cancelled anymore." });
        }

        const orderItems = await OrderItem.findAll({ where: { orderId: order.id } });
        for (const item of orderItems) {
            const product = await Product.findByPk(item.productId);
            if (product) {
                product.stock += item.qty;
                await product.save();
            }
        }

        order.status = "CANCELLED";
        order.cancelReason = req.body.reason || "No reason provided";
        await order.save();

        res.json(order);
    } catch (err) {
        res.status(500).json({ message: "Failed to cancel order", error: err.message });
    }
};

// NEW: Submit Delivery Feedback
exports.submitDeliveryFeedback = async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id);
        if (!order) return res.status(404).json({ message: "Order not found" });

        const { rating, feedback } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: "Rating must be between 1 and 5" });
        }

        order.deliveryRating = rating;
        order.deliveryFeedback = feedback || "";
        await order.save();

        res.json({ message: "Feedback submitted successfully", order });
    } catch (err) {
        res.status(500).json({ message: "Failed to submit feedback", error: err.message });
    }
};