const router = require("express").Router();
const { createOrder, getMyOrders, getOrder, updateOrderStatus } = require("../controllers/orderController");
const { protect, adminOnly } = require("../middleware/auth");

router.post("/", protect, createOrder);
router.get("/", protect, getMyOrders);
router.get("/:id", protect, getOrder);
router.put("/:id/status", protect, adminOnly, updateOrderStatus);

module.exports = router;