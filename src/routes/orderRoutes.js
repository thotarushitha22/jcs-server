const router = require("express").Router();
const {
    createOrder,
    getMyOrders,
    getAllOrders,
    getOrder,
    updateOrderStatus,
    cancelOrder,
    submitDeliveryFeedback
} = require("../controllers/orderController");

// 🚨 IMPORT THE NEW MIDDLEWARE
const { protect, adminOnly, adminOrMerchant, adminMerchantOrDelivery } = require("../middleware/auth");

router.post("/", protect, createOrder);
router.get("/", protect, getMyOrders);

// 🚨 UPDATED: Use the new middleware so delivery agents can fetch all orders
router.get("/all", protect, adminMerchantOrDelivery, getAllOrders);

router.get("/admin/all", protect, adminOnly, getAllOrders);

// Cancellation and Feedback routes
router.put("/:id/cancel", protect, cancelOrder);
router.post("/:id/feedback", protect, submitDeliveryFeedback);

router.get("/:id", protect, getOrder);

// 🚨 UPDATED: Use the new middleware so delivery agents can update order status
router.put("/:id/status", protect, adminMerchantOrDelivery, updateOrderStatus);

module.exports = router;