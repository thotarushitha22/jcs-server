const { Op } = require("sequelize");
const Product = require("../models/Product");
const Category = require("../models/Category");

// GET /api/products?category=smartphones&search=galaxy&sort=price-asc&page=1&limit=12
exports.getProducts = async (req, res) => {
    try {
        const { category, search, sort, page = 1, limit = 12 } = req.query;
        const where = {};
        const include = [{ model: Category, as: "category", attributes: ["id", "name", "slug"] }];

        if (category && category !== "all") {
            include[0].where = { slug: category };
        }
        if (search) {
            where[Op.or] = [
                { title: { [Op.iLike]: `%${search}%` } },
                { brand: { [Op.iLike]: `%${search}%` } },
            ];
        }

        let order = [["createdAt", "DESC"]];
        if (sort === "price-asc") order = [["price", "ASC"]];
        if (sort === "price-desc") order = [["price", "DESC"]];

        const offset = (page - 1) * limit;

        const { rows, count } = await Product.findAndCountAll({
            where,
            include,
            order,
            limit: Number(limit),
            offset: Number(offset),
        });

        res.json({ products: rows, total: count, page: Number(page), pages: Math.ceil(count / limit) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch products", error: err.message });
    }
};

// GET /api/products/mine  (protected — seller/admin sees their own listings)
exports.getMyProducts = async (req, res) => {
    try {
        const products = await Product.findAll({
            where: { createdBy: req.user.id },
            include: [{ model: Category, as: "category", attributes: ["id", "name", "slug"] }],
            order: [["createdAt", "DESC"]],
        });
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch your listings", error: err.message });
    }
};

// GET /api/products/:id
exports.getProduct = async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id, {
            include: [{ model: Category, as: "category", attributes: ["id", "name", "slug"] }],
        });
        if (!product) return res.status(404).json({ message: "Product not found" });
        res.json(product);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch product", error: err.message });
    }
};

// GET /api/products/:id/related
exports.getRelatedProducts = async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id);
        if (!product) return res.status(404).json({ message: "Product not found" });
        const related = await Product.findAll({
            where: { categoryId: product.categoryId, id: { [Op.ne]: product.id } },
            limit: 3,
        });
        res.json(related);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch related products", error: err.message });
    }
};

// POST /api/products  (any logged-in seller or admin — sellers own what they create)
exports.createProduct = async (req, res) => {
    try {
        const product = await Product.create({ ...req.body, createdBy: req.user.id });
        res.status(201).json(product);
    } catch (err) {
        res.status(400).json({ message: "Failed to create product", error: err.message });
    }
};

// PUT /api/products/:id  (admin, or the seller who created it)
exports.updateProduct = async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id);
        if (!product) return res.status(404).json({ message: "Product not found" });

        if (req.user.role !== "admin" && product.createdBy !== req.user.id) {
            return res.status(403).json({ message: "You can only edit your own listings" });
        }

        await product.update(req.body);
        res.json(product);
    } catch (err) {
        res.status(400).json({ message: "Failed to update product", error: err.message });
    }
};

// DELETE /api/products/:id  (admin, or the seller who created it)
exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id);
        if (!product) return res.status(404).json({ message: "Product not found" });

        if (req.user.role !== "admin" && product.createdBy !== req.user.id) {
            return res.status(403).json({ message: "You can only delete your own listings" });
        }

        await product.destroy();
        res.json({ message: "Product deleted" });
    } catch (err) {
        res.status(500).json({ message: "Failed to delete product", error: err.message });
    }
};