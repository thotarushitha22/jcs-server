const router = require("express").Router();
const { createOrder, getMyOrders, getAllOrders, getOrder, updateOrderStatus } = require("../controllers/orderController");
const { protect, adminOrMerchant } = require("../middleware/auth");

router.post("/", protect, createOrder);
router.get("/", protect, getMyOrders);
router.get("/all", protect, adminOrMerchant, getAllOrders); // must be before /:id
router.get("/:id", protect, getOrder);
router.put("/:id/status", protect, adminOrMerchant, updateOrderStatus);

module.exports = router;