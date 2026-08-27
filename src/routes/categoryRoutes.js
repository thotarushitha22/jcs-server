const router = require("express").Router();
const { protect, adminOnly } = require("../middleware/auth");
const {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
} = require("../controllers/categoryController");

// Public routes
router.get("/", getCategories);
router.get("/:id", getCategoryById);

// Admin protected routes
router.post("/", protect, adminOnly, createCategory);
router.put("/:id", protect, adminOnly, updateCategory);
router.delete("/:id", protect, adminOnly, deleteCategory);

module.exports = router;