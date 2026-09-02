const router = require("express").Router();

const {
    createOrder,
    getAllOrders,
    getMyOrders,
    getOrderById,
    updateOrderStatus
} = require("../controllers/orderController");

const authModule = require("../middleware/auth");


// ==========================================
// AUTH MIDDLEWARE
// ==========================================

let protect;
let sellerOnly;

if (typeof authModule === "function") {

    protect = authModule;
    sellerOnly = authModule;

} else if (
    authModule &&
    typeof authModule === "object"
) {

    protect =
        authModule.protect ||
        authModule.verifyToken ||
        ((req, res, next) => next());

    sellerOnly =
        authModule.sellerOnly ||
        authModule.adminOnly ||
        protect;

} else {

    protect =
        (req, res, next) => next();

    sellerOnly =
        (req, res, next) => next();
}


// ==========================================
// CREATE ORDER
// POST /api/orders
// ==========================================

router.post(
    "/",
    protect,
    createOrder
);


// ==========================================
// CUSTOMER ORDERS
// GET /api/orders
// GET /api/orders/mine
// GET /api/orders/myorders
// ==========================================

router.get(
    "/",
    protect,
    getMyOrders
);

router.get(
    "/mine",
    protect,
    getMyOrders
);

router.get(
    "/myorders",
    protect,
    getMyOrders
);


// ==========================================
// ADMIN ALL ORDERS
// GET /api/orders/admin/all
// ==========================================

router.get(
    "/admin/all",
    protect,
    sellerOnly,
    getAllOrders
);


// ==========================================
// GET SINGLE ORDER
// GET /api/orders/:id
// ==========================================

router.get(
    "/:id",
    protect,
    getOrderById
);


// ==========================================
// UPDATE ORDER STATUS
// PUT /api/orders/:id/status
// ==========================================

router.put(
    "/:id/status",
    protect,
    sellerOnly,
    updateOrderStatus
);


module.exports = router;