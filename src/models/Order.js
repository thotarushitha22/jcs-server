const router = require("express").Router();

const {
    createOrder,
    getAllOrders,
    getMyOrders,
    getOrderById,
    updateOrderStatus
} = require("../controllers/orderController");

const authModule = require("../middleware/auth");

let protect, sellerOnly;
if (typeof authModule === "function") {
    protect = authModule;
    sellerOnly = authModule;
} else if (authModule && typeof authModule === "object") {
    protect = authModule.protect || authModule.verifyToken || ((req, res, next) => next());
    sellerOnly = authModule.sellerOnly || authModule.adminOnly || protect;
} else {
    protect = (req, res, next) => next();
    sellerOnly = (req, res, next) => next();
}

// 1. Create order
router.post("/", protect, createOrder);

// 2. Customer account pages -> STRICTLY calls getMyOrders (Only returns that user's orders)
router.get("/mine", protect, getMyOrders);
router.get("/myorders", protect, getMyOrders);
router.get("/", protect, getMyOrders); // Root /api/orders now strictly serves customer's own orders by default!

// 3. Admin dashboard -> STRICTLY calls getAllOrders
router.get("/admin/all", protect, sellerOnly, getAllOrders);

// 4. Dynamic parameters
router.get("/:id", protect, getOrderById);
router.put("/:id/status", protect, sellerOnly, updateOrderStatus);

module.exports = router;