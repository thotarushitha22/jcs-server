const router = require("express").Router();
const { createOrder, getMyOrders, getOrder, updateOrderStatus } = require("../controllers/orderController");
const { protect, adminOrMerchant } = require("../middleware/auth");

router.post("/", protect, createOrder);
router.get("/", protect, getMyOrders);
router.get("/:id", protect, getOrder);
router.put("/:id/status", protect, adminOrMerchant, updateOrderStatus);

module.exports = router;