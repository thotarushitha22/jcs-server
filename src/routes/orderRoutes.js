const router = require("express").Router();

// Import the cancelOrder function here
const {
    createOrder,
    getMyOrders,
    getAllOrders,
    getOrder,
    updateOrderStatus,
    cancelOrder,
} = require("../controllers/orderController");

const { protect, adminOnly, adminOrMerchant } = require("../middleware/auth");

router.post("/", protect, createOrder);
router.get("/", protect, getMyOrders);

// every order in the store (merchant dashboard)
router.get("/all", protect, adminOrMerchant, getAllOrders);

// same list, used by the admin panel
router.get("/admin/all", protect, adminOnly, getAllOrders);

// NEW: Customer cancellation route (Must be above /:id routes to avoid conflicts)
router.put("/:id/cancel", protect, cancelOrder);

router.get("/:id", protect, getOrder);
router.put("/:id/status", protect, adminOrMerchant, updateOrderStatus);

module.exports = router;