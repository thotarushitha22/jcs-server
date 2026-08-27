const router = require("express").Router();
// 1. Import sellerOrAdmin instead of adminOnly
const { protect, sellerOrAdmin } = require("../middleware/auth");
const { createProduct, getProducts, getProductById } = require("../controllers/productController");

router.get("/", getProducts);
router.get("/:id", getProductById);

// 2. Change adminOnly to sellerOrAdmin here:
router.post("/", protect, sellerOrAdmin, createProduct);

module.exports = router;