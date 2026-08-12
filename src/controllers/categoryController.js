const Category = require("../models/Category");

// GET /api/categories
exports.getCategories = async (req, res) => {
    try {
        const categories = await Category.findAll({ order: [["name", "ASC"]] });
        res.json(categories);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch categories", error: err.message });
    }
};

// POST /api/categories  (admin only)
exports.createCategory = async (req, res) => {
    try {
        const { name, slug } = req.body;
        const category = await Category.create({ name, slug });
        res.status(201).json(category);
    } catch (err) {
        res.status(400).json({ message: "Failed to create category", error: err.message });
    }
};