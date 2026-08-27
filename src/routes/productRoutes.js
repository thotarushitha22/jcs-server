const router = require("express").Router();
const {
    getProducts,
    getMyProducts,
    getProduct,
    getRelatedProducts,
    createProduct,
    updateProduct,
    deleteProduct,
} = require("../controllers/productController");
const { protect } = require("../middleware/auth");

// Public reads
router.get("/", getProducts);
router.get("/mine", protect, getMyProducts); // must come before /:id so "mine" isn't treated as an id
router.get("/:id", getProduct);
router.get("/:id/related", getRelatedProducts);

// Any logged-in seller or admin can create/manage listings —
// ownership checks happen inside the controller (sellers can only touch their own).
router.post("/", protect, createProduct);
router.put("/:id", protect, updateProduct);
router.delete("/:id", protect, deleteProduct);

module.exports = router;