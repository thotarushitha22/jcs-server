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

// 🚨 FIX: Removed the role check here so ANY logged-in user can fetch orders
router.get("/all", protect, getAllOrders);

router.get("/admin/all", protect, adminOnly, getAllOrders);

router.put("/:id/cancel", protect, cancelOrder);
router.post("/:id/feedback", protect, submitDeliveryFeedback);

router.get("/:id", protect, getOrder);

// We still keep the check here to ensure only delivery/merchant can update status
router.put("/:id/status", protect, adminMerchantOrDelivery, updateOrderStatus);

module.exports = router;