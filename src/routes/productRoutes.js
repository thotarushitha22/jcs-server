const express = require("express");
const router = express.Router();
const { protect, sellerOrAdmin } = require("../middleware/auth");
const {
    getProducts,
    getMyProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
} = require("../controllers/productController");

router.get("/", getProducts);
router.get("/mine", protect, sellerOrAdmin, getMyProducts);
router.get("/:id", getProductById);

router.post("/", protect, sellerOrAdmin, createProduct);
router.put("/:id", protect, sellerOrAdmin, updateProduct);
router.delete("/:id", protect, sellerOrAdmin, deleteProduct);

module.exports = router;