const router = require("express").Router();

const {
    createOrder,
    getAllOrders,
    getMyOrders,
    getOrderById,
    updateOrderStatus
} = require("../controllers/orderController");

const authModule = require("../middleware/auth");

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
// ==========================================

router.post(
    "/",
    protect,
    createOrder
);


// ==========================================
// CUSTOMER ORDERS
// ==========================================

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

router.get(
    "/",
    protect,
    getMyOrders
);


// ==========================================
// ADMIN ALL ORDERS
// ==========================================

router.get(
    "/admin/all",
    protect,
    sellerOnly,
    getAllOrders
);


// ==========================================
// SINGLE ORDER
// ==========================================

router.get(
    "/:id",
    protect,
    getOrderById
);


// ==========================================
// UPDATE ORDER STATUS
// ==========================================

router.put(
    "/:id/status",
    protect,
    sellerOnly,
    updateOrderStatus
);


module.exports = router;