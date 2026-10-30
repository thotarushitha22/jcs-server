const router = require("express").Router();
const {
    createOrder, getMyOrders, getAllOrders, getOrder, updateOrderStatus, cancelOrder, submitDeliveryFeedback
} = require("../controllers/orderController");
const { protect, adminOnly, adminOrMerchant } = require("../middleware/auth");

router.post("/", protect, createOrder);
router.get("/", protect, getMyOrders);
router.get("/all", protect, adminOrMerchant, getAllOrders);
router.get("/admin/all", protect, adminOnly, getAllOrders);

// Cancellation and Feedback routes
router.put("/:id/cancel", protect, cancelOrder);
router.post("/:id/feedback", protect, submitDeliveryFeedback);

router.get("/:id", protect, getOrder);
router.put("/:id/status", protect, adminOrMerchant, updateOrderStatus);

module.exports = router;