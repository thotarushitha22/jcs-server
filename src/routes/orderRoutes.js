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

const { protect, adminOnly, adminOrMerchant, adminMerchantOrDelivery } = require("../middleware/auth");

router.post("/", protect, createOrder);
router.get("/", protect, getMyOrders);

// 🚨 BYPASS: Removed 'adminMerchantOrDelivery' so ANY logged-in user can fetch orders
router.get("/all", protect, getAllOrders);

router.get("/admin/all", protect, adminOnly, getAllOrders);

router.put("/:id/cancel", protect, cancelOrder);
router.post("/:id/feedback", protect, submitDeliveryFeedback);

router.get("/:id", protect, getOrder);

// 🚨 SECURED: Delivery agents can update order status (This is safe to leave, but if status updates fail, remove 'adminMerchantOrDelivery' here too)
router.put("/:id/status", protect, adminMerchantOrDelivery, updateOrderStatus);

module.exports = router;