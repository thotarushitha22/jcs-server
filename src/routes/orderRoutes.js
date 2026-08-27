const router = require("express").Router();
const { protect, sellerOnly } = require("../middleware/auth");
const {
    createOrder,
    getMyOrders,
    getOrderById,
    getSellerOrders,
    updateOrderStatus,
} = require("../controllers/orderController");

// Buyer routes
router.post("/", protect, createOrder);
router.get("/mine", protect, getMyOrders);
router.get("/seller/all", protect, sellerOnly, getSellerOrders); // Place before /:id route
router.get("/:id", protect, getOrderById);

// Seller routes
router.put("/:id/status", protect, sellerOnly, updateOrderStatus);

module.exports = router;