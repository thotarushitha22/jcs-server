const router = require("express").Router();
const { getCategories, createCategory } = require("../controllers/categoryController");
const { protect, adminOnly } = require("../middleware/auth");

router.get("/", getCategories);
router.post("/", protect, adminOnly, createCategory);

module.exports = router;