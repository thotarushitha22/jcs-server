const Order = require("../models/Order"); // Adjust path to your Order model if needed

// @desc    Create new order
// @route   POST /api/orders
const createOrder = async (req, res) => {
    try {
        const { orderItems, shippingAddress, paymentMethod, itemsPrice, taxPrice, shippingPrice, totalPrice } = req.body;

        if (!orderItems || orderItems.length === 0) {
            return res.status(400).json({ message: "No order items provided" });
        }

        const order = await Order.create({
            orderItems,
            user: req.user.id || req.user._id,
            shippingAddress,
            paymentMethod,
            itemsPrice,
            taxPrice,
            shippingPrice,
            totalPrice,
        });

        res.status(201).json(order);
    } catch (error) {
        res.status(500).json({ message: "Failed to create order", error: error.message });
    }
};

// @desc    Get logged-in user's orders
// @route   GET /api/orders/mine
const getMyOrders = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const orders = await Order.find({ user: userId });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch your orders", error: error.message });
    }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate("user", "name email");
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch order", error: error.message });
    }
};

// @desc    Get orders for seller items
// @route   GET /api/orders/seller/all
const getSellerOrders = async (req, res) => {
    try {
        const sellerId = req.user.id || req.user._id;
        const orders = await Order.find({ "orderItems.seller": sellerId });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch seller orders", error: error.message });
    }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
const updateOrderStatus = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        order.status = req.body.status || order.status;
        if (req.body.status === "Delivered") {
            order.isDelivered = true;
            order.deliveredAt = Date.now();
        }

        const updatedOrder = await order.save();
        res.json(updatedOrder);
    } catch (error) {
        res.status(500).json({ message: "Failed to update order status", error: error.message });
    }
};

// Export all controller functions cleanly
module.exports = {
    createOrder,
    getMyOrders,
    getOrderById,
    getSellerOrders,
    updateOrderStatus,
};