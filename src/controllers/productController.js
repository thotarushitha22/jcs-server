const Product = require("../models/Product");
const Category = require("../models/Category");

// =====================================================
// CREATE PRODUCT
// POST /api/products
// =====================================================

exports.createProduct = async (req, res) => {
    try {
        const productData = {
            // -------------------------------
            // Basic information
            // -------------------------------
            title: req.body.title,
            brand: req.body.brand || null,
            sku: req.body.sku || null,
            model: req.body.model || null,

            // -------------------------------
            // Price & inventory
            // -------------------------------
            price: req.body.price,
            mrp: req.body.mrp || req.body.price,
            stock: Number(req.body.stock) || 0,
            moq: Number(req.body.moq) || 1,
            gstPercent: Number(req.body.gstPercent) || 18,

            // -------------------------------
            // Description
            // -------------------------------
            overview: req.body.overview || null,
            description: req.body.description || req.body.overview || null,

            // -------------------------------
            // Product highlights
            // -------------------------------
            highlights: Array.isArray(req.body.highlights)
                ? req.body.highlights
                : [],

            // -------------------------------
            // Product specifications
            // -------------------------------
            colour: req.body.colour || null,
            storage: req.body.storage || null,
            ram: req.body.ram || null,
            networkGen: req.body.networkGen || null,
            simSlots: req.body.simSlots || null,
            screenSize: req.body.screenSize || null,
            rearCamera: req.body.rearCamera || null,
            frontCamera: req.body.frontCamera || null,
            securityFeatures: req.body.securityFeatures || null,
            weight: req.body.weight || null,
            waterResistant: req.body.waterResistant || null,
            fastCharging: req.body.fastCharging || null,

            // -------------------------------
            // Warranty
            // -------------------------------
            warranty: req.body.warranty || null,

            // -------------------------------
            // Images
            // -------------------------------
            images: Array.isArray(req.body.images)
                ? req.body.images
                : [],

            // -------------------------------
            // Variants
            // -------------------------------
            variants: req.body.variants || null,

            // -------------------------------
            // Category
            // -------------------------------
            categoryId: req.body.categoryId
                ? Number(req.body.categoryId)
                : null,

            // -------------------------------
            // Merchant / creator
            // -------------------------------
            merchantId: req.user?.merchantId || null,
            createdBy: req.user?.id || null,

            // -------------------------------
            // Approval
            // -------------------------------
            approvalStatus: "PENDING",
            verified: false,

            approvedBy: null,
            approvedAt: null,
            rejectionReason: null
        };

        // Validate title
        if (!productData.title) {
            return res.status(400).json({
                message: "Product title is required"
            });
        }

        // Validate price
        if (
            productData.price === undefined ||
            productData.price === null ||
            productData.price === ""
        ) {
            return res.status(400).json({
                message: "Product price is required"
            });
        }

        // Validate category
        if (!productData.categoryId) {
            return res.status(400).json({
                message: "Category is required"
            });
        }

        // Check category exists
        const category = await Category.findByPk(productData.categoryId);

        if (!category) {
            return res.status(400).json({
                message: "Selected category does not exist"
            });
        }

        // Check duplicate SKU
        if (productData.sku) {
            const existingProduct = await Product.findOne({
                where: {
                    sku: productData.sku
                }
            });

            if (existingProduct) {
                return res.status(400).json({
                    message: "A product with this SKU already exists"
                });
            }
        }

        // Create product
        const product = await Product.create(productData);

        // Return created product with category
        const createdProduct = await Product.findByPk(product.id, {
            include: [
                {
                    model: Category,
                    as: "category"
                }
            ]
        });

        return res.status(201).json({
            message: "Product created successfully",
            product: createdProduct
        });

    } catch (error) {
        console.error("CREATE PRODUCT ERROR:", error);

        return res.status(500).json({
            message: "Failed to create product",
            error: error.message
        });
    }
};


// =====================================================
// GET ALL PRODUCTS
// GET /api/products
// =====================================================

exports.getProducts = async (req, res) => {
    try {
        const products = await Product.findAll({
            include: [
                {
                    model: Category,
                    as: "category"
                }
            ],
            order: [["createdAt", "DESC"]]
        });

        return res.status(200).json(products);

    } catch (error) {
        console.error("GET PRODUCTS ERROR:", error);

        return res.status(500).json({
            message: "Failed to fetch products",
            error: error.message
        });
    }
};


// =====================================================
// GET SINGLE PRODUCT
// GET /api/products/:id
// =====================================================

exports.getProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findByPk(id, {
            include: [
                {
                    model: Category,
                    as: "category"
                }
            ]
        });

        if (!product) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        return res.status(200).json(product);

    } catch (error) {
        console.error("GET PRODUCT ERROR:", error);

        return res.status(500).json({
            message: "Failed to fetch product",
            error: error.message
        });
    }
};


// =====================================================
// GET MERCHANT PRODUCTS
// GET /api/products/my-products
// =====================================================

exports.getMyProducts = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                message: "Unauthorized"
            });
        }

        const products = await Product.findAll({
            where: {
                createdBy: userId
            },
            include: [
                {
                    model: Category,
                    as: "category"
                }
            ],
            order: [["createdAt", "DESC"]]
        });

        return res.status(200).json(products);

    } catch (error) {
        console.error("GET MY PRODUCTS ERROR:", error);

        return res.status(500).json({
            message: "Failed to fetch merchant products",
            error: error.message
        });
    }
};


// =====================================================
// UPDATE PRODUCT
// PUT /api/products/:id
// =====================================================

exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findByPk(id);

        if (!product) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        // -----------------------------------------
        // Only update fields that exist in request
        // -----------------------------------------

        const allowedFields = [
            "title",
            "brand",
            "sku",
            "model",
            "price",
            "mrp",
            "stock",
            "moq",
            "gstPercent",
            "overview",
            "description",
            "highlights",
            "colour",
            "storage",
            "ram",
            "networkGen",
            "simSlots",
            "screenSize",
            "rearCamera",
            "frontCamera",
            "securityFeatures",
            "weight",
            "waterResistant",
            "fastCharging",
            "warranty",
            "images",
            "variants",
            "categoryId"
        ];

        const updateData = {};

        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });

        // Convert numeric fields
        if (updateData.price !== undefined) {
            updateData.price = Number(updateData.price);
        }

        if (updateData.mrp !== undefined) {
            updateData.mrp = Number(updateData.mrp);
        }

        if (updateData.stock !== undefined) {
            updateData.stock = Number(updateData.stock);
        }

        if (updateData.moq !== undefined) {
            updateData.moq = Number(updateData.moq);
        }

        if (updateData.gstPercent !== undefined) {
            updateData.gstPercent = Number(updateData.gstPercent);
        }

        if (updateData.categoryId !== undefined) {
            updateData.categoryId = Number(updateData.categoryId);
        }

        // Update product
        await product.update(updateData);

        // Fetch updated product
        const updatedProduct = await Product.findByPk(id, {
            include: [
                {
                    model: Category,
                    as: "category"
                }
            ]
        });

        return res.status(200).json({
            message: "Product updated successfully",
            product: updatedProduct
        });

    } catch (error) {
        console.error("UPDATE PRODUCT ERROR:", error);

        return res.status(500).json({
            message: "Failed to update product",
            error: error.message
        });
    }
};


// =====================================================
// DELETE PRODUCT
// DELETE /api/products/:id
// =====================================================

exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findByPk(id);

        if (!product) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        await product.destroy();

        return res.status(200).json({
            message: "Product deleted successfully"
        });

    } catch (error) {
        console.error("DELETE PRODUCT ERROR:", error);

        return res.status(500).json({
            message: "Failed to delete product",
            error: error.message
        });
    }
};