const Category = require("../models/Category"); // Adjust path to your Category model if needed

// @desc    Get all categories
// @route   GET /api/categories
const getCategories = async (req, res) => {
    try {
        const categories = await Category.find();
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch categories", error: error.message });
    }
};

// @desc    Get single category by ID
// @route   GET /api/categories/:id
const getCategoryById = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }
        res.json(category);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch category", error: error.message });
    }
};

// @desc    Create new category
// @route   POST /api/categories
const createCategory = async (req, res) => {
    try {
        const { name, description, image } = req.body;
        const categoryExists = await Category.findOne({ name });

        if (categoryExists) {
            return res.status(400).json({ message: "Category already exists" });
        }

        const category = await Category.create({ name, description, image });
        res.status(201).json(category);
    } catch (error) {
        res.status(500).json({ message: "Failed to create category", error: error.message });
    }
};

// @desc    Update category
// @route   PUT /api/categories/:id
const updateCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        res.json(updatedCategory);
    } catch (error) {
        res.status(500).json({ message: "Failed to update category", error: error.message });
    }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
const deleteCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }

        await category.deleteOne();
        res.json({ message: "Category removed" });
    } catch (error) {
        res.status(500).json({ message: "Failed to delete category", error: error.message });
    }
};

// Ensure ALL functions used in categoryRoutes are exported here
module.exports = {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
};