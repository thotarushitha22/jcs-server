const pool = require("../config/db");

// Get all products with safe, flexible category filtering
const getProducts = async (req, res) => {
    try {
        const { category } = req.query;
        let query = "SELECT * FROM products";
        let params = [];

        if (category && category.trim() !== "" && category.toLowerCase() !== "all" && category !== "All categories") {
            query += " WHERE category ILIKE $1";
            params.push(`%${category}%`);
        }

        query += " ORDER BY id DESC";
        const result = await pool.query(query, params);
        res.json({ products: result.rows });
    } catch (error) {
        console.error("Category filter fallback triggered:", error.message);
        try {
            const fallbackResult = await pool.query("SELECT * FROM products ORDER BY id DESC");
            res.json({ products: fallbackResult.rows });
        } catch (innerError) {
            res.status(500).json({ message: "Server error", error: innerError.message });
        }
    }
};

// Fetch distinct categories from database with a fallback list
const getCategories = async (req, res) => {
    const defaultCategories = ["Smartphones", "Tablets", "TVs", "Accessories", "Laptops", "Electronics"];
    try {
        const result = await pool.query("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ''");

        let categories = result.rows.map((row, index) => ({
            id: index + 1,
            slug: row.category,
            name: row.category
        }));

        if (categories.length === 0) {
            categories = defaultCategories.map((cat, index) => ({ id: index + 1, slug: cat, name: cat }));
        }

        res.json(categories);
    } catch (error) {
        res.json(defaultCategories.map((cat, index) => ({ id: index + 1, slug: cat, name: cat })));
    }
};

// Get merchant products
const getMyProducts = async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM products ORDER BY id DESC");
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching my products:", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Get single product by ID
const getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("SELECT * FROM products WHERE id = $1", [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching product by ID:", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Create a new product with explicit timestamps for both createdAt and updatedAt
const createProduct = async (req, res) => {
    try {
        const { title, price, stock, overview, images, category } = req.body;

        const safeTitle = title || "Untitled Product";
        const safePrice = price ? parseFloat(price) : 0;
        const safeStock = stock ? parseInt(stock, 10) : 0;
        const safeOverview = overview || "";
        const safeCategory = category || "Electronics";
        const imageJSON = JSON.stringify(images || []);

        const query = `
            INSERT INTO products (title, price, stock, overview, images, category, "createdAt", "updatedAt") 
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *
        `;

        const result = await pool.query(query, [
            safeTitle,
            safePrice,
            safeStock,
            safeOverview,
            imageJSON,
            safeCategory
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Create product error details:", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Update an existing product
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, price, stock, overview, category } = req.body;
        const query = `
            UPDATE products 
            SET title = $1, price = $2, stock = $3, overview = $4, category = $5, "updatedAt" = NOW() 
            WHERE id = $6 RETURNING *
        `;
        const result = await pool.query(query, [title, price, stock, overview, category, id]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Update product error:", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Delete a product by ID
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("DELETE FROM products WHERE id = $1 RETURNING *", [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.json({ message: "Product deleted successfully", product: result.rows[0] });
    } catch (error) {
        console.error("Delete product error:", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = {
    getProducts,
    getCategories,
    getMyProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
};