const pool = require("../config/db"); // Your Neon PostgreSQL connection pool

// @desc    Get all products
// @route   GET /api/products
const getProducts = async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM products ORDER BY created_at DESC");
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch products", error: error.message });
    }
};

// @desc    Get merchant's own products
// @route   GET /api/products/mine
const getMyProducts = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId || req.user._id;
        const { rows } = await pool.query("SELECT * FROM products WHERE seller_id = $1", [userId]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch merchant products", error: error.message });
    }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
const getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "Product not found" });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch product", error: error.message });
    }
};

// @desc    Create new product
// @route   POST /api/products
const createProduct = async (req, res) => {
    try {
        const { title, brand, price, mrp, stock, moq, categoryId, sku, model, gstPercent, overview, warranty, images } = req.body;
        const sellerId = req.user.id || req.user.userId || req.user._id;

        const queryText = `
            INSERT INTO products 
            (title, brand, price, mrp, stock, moq, category_id, sku, model, gst_percent, overview, warranty, images, seller_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *;
        `;

        const values = [
            title, brand, price, mrp, stock, moq,
            categoryId, sku, model, gstPercent,
            overview, warranty, JSON.stringify(images || []), sellerId
        ];

        const { rows } = await pool.query(queryText, values);
        res.status(201).json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: "Failed to create product", error: error.message });
    }
};

// @desc    Update product
// @route   PUT /api/products/:id
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, price, stock } = req.body;

        const { rows } = await pool.query(
            "UPDATE products SET title = COALESCE($1, title), price = COALESCE($2, price), stock = COALESCE($3, stock) WHERE id = $4 RETURNING *",
            [title, price, stock, id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: "Failed to update product", error: error.message });
    }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("DELETE FROM products WHERE id = $1", [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.json({ message: "Product removed successfully" });
    } catch (error) {
        res.status(500).json({ message: "Failed to delete product", error: error.message });
    }
};

// Export ALL functions referenced in productRoutes
module.exports = {
    getProducts,
    getMyProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
};