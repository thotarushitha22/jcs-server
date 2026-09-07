const express = require("express");
const router = express.Router();
const dbPool = require("../config/db");
const pool = dbPool.pool || dbPool;
const multer = require("multer");

const { protect } = require("../middleware/auth");

const storage = multer.memoryStorage();
const upload = multer({ storage });

/* =========================================================
   GET ALL APPROVED PRODUCTS
   Customer-facing product list
   ========================================================= */
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT *
             FROM products
             WHERE title IS NOT NULL
               AND title != ''
               AND price > 0
               AND (
                    "approvalStatus" = 'APPROVED'
                    OR "approvalStatus" IS NULL
               )
             ORDER BY id DESC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Get products error:", error);

        res.status(500).json({
            message: "Failed to fetch products",
            error: error.message
        });
    }
});


/* =========================================================
   GET MERCHANT'S PRODUCTS
   ========================================================= */
router.get("/my-products", protect, async (req, res) => {
    try {
        const merchantId =
            req.user?.id ||
            req.user?.userId ||
            req.user?._id;

        if (!merchantId) {
            return res.status(401).json({
                message: "Merchant ID is required"
            });
        }

        const result = await pool.query(
            `SELECT *
             FROM products
             WHERE "merchantId" = $1
                OR "createdBy" = $1
             ORDER BY id DESC`,
            [merchantId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Get merchant products error:", error);

        res.status(500).json({
            message: "Failed to fetch merchant products",
            error: error.message
        });
    }
});


/* =========================================================
   ADMIN - GET ALL PRODUCTS
   Includes PENDING / APPROVED / REJECTED
   ========================================================= */
router.get("/admin/all", protect, async (req, res) => {
    try {
        const role = String(req.user?.role || "").toLowerCase();

        if (role !== "admin") {
            return res.status(403).json({
                message: "Admin access required"
            });
        }

        const result = await pool.query(
            `SELECT *
             FROM products
             ORDER BY id DESC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Admin get products error:", error);

        res.status(500).json({
            message: "Failed to fetch all products",
            error: error.message
        });
    }
});


/* =========================================================
   ADMIN - APPROVE PRODUCT
   ========================================================= */
router.put("/admin/:id/approve", protect, async (req, res) => {
    try {
        const role = String(req.user?.role || "").toLowerCase();

        if (role !== "admin") {
            return res.status(403).json({
                message: "Admin access required"
            });
        }

        const productId = req.params.id;

        const approvedBy =
            req.user?.id ||
            req.user?.userId ||
            req.user?._id ||
            null;

        const result = await pool.query(
            `UPDATE products
             SET "approvalStatus" = 'APPROVED',
                 "rejectionReason" = NULL,
                 "approvedBy" = $1,
                 "approvedAt" = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [approvedBy, productId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.json({
            message: "Product approved successfully",
            product: result.rows[0]
        });
    } catch (error) {
        console.error("Approve product error:", error);

        res.status(500).json({
            message: "Failed to approve product",
            error: error.message
        });
    }
});


/* =========================================================
   ADMIN - REJECT PRODUCT
   ========================================================= */
router.put("/admin/:id/reject", protect, async (req, res) => {
    try {
        const role = String(req.user?.role || "").toLowerCase();

        if (role !== "admin") {
            return res.status(403).json({
                message: "Admin access required"
            });
        }

        const productId = req.params.id;

        const rejectionReason =
            req.body?.rejectionReason ||
            "Product rejected by administrator";

        const result = await pool.query(
            `UPDATE products
             SET "approvalStatus" = 'REJECTED',
                 "rejectionReason" = $1,
                 "approvedBy" = NULL,
                 "approvedAt" = NULL
             WHERE id = $2
             RETURNING *`,
            [rejectionReason, productId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.json({
            message: "Product rejected successfully",
            product: result.rows[0]
        });
    } catch (error) {
        console.error("Reject product error:", error);

        res.status(500).json({
            message: "Failed to reject product",
            error: error.message
        });
    }
});


/* =========================================================
   GET SINGLE APPROVED PRODUCT
   Customer-facing
   ========================================================= */
router.get("/:id", async (req, res) => {
    try {
        const productId = req.params.id;

        const result = await pool.query(
            `SELECT *
             FROM products
             WHERE id = $1
               AND title IS NOT NULL
               AND title != ''
               AND price > 0
               AND (
                    "approvalStatus" = 'APPROVED'
                    OR "approvalStatus" IS NULL
               )`,
            [productId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Get product error:", error);

        res.status(500).json({
            message: "Failed to fetch product",
            error: error.message
        });
    }
});


/* =========================================================
   CREATE PRODUCT
   Merchant -> PENDING
   Admin -> APPROVED
   ========================================================= */
router.post("/", protect, upload.any(), async (req, res) => {
    try {
        const {
            title,
            price,
            stock,
            category,
            brand,
            description,
            image,
            merchantId
        } = req.body;

        if (!title || !price) {
            return res.status(400).json({
                message: "Product title and price are required"
            });
        }

        const userId =
            req.user?.id ||
            req.user?.userId ||
            req.user?._id;

        if (!userId) {
            return res.status(401).json({
                message: "User authentication required"
            });
        }

        const userRole = String(
            req.user?.role || ""
        ).toLowerCase();

        /*
         * Merchant products require admin approval.
         * Admin products are automatically approved.
         */
        const approvalStatus =
            userRole === "admin"
                ? "APPROVED"
                : "PENDING";

        const approvedBy =
            approvalStatus === "APPROVED"
                ? userId
                : null;

        const approvedAt =
            approvalStatus === "APPROVED"
                ? new Date()
                : null;

        /*
         * Prefer authenticated user's ID.
         * This prevents a merchant from creating a product
         * under another merchant's account.
         */
        const finalMerchantId =
            userRole === "admin"
                ? (merchantId || null)
                : userId;

        const result = await pool.query(
            `INSERT INTO products
            (
                title,
                price,
                stock,
                category,
                brand,
                description,
                image,
                "merchantId",
                "createdBy",
                "approvalStatus",
                "rejectionReason",
                "approvedBy",
                "approvedAt"
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                NULL,
                $11,
                $12
            )
            RETURNING *`,
            [
                title,
                price,
                stock || 0,
                category || null,
                brand || null,
                description || null,
                image || null,
                finalMerchantId,
                userId,
                approvalStatus,
                approvedBy,
                approvedAt
            ]
        );

        res.status(201).json({
            message:
                approvalStatus === "PENDING"
                    ? "Product submitted for admin approval"
                    : "Product created successfully",

            product: result.rows[0]
        });
    } catch (error) {
        console.error("Create product error:", error);

        res.status(500).json({
            message: "Failed to create product",
            error: error.message
        });
    }
});


/* =========================================================
   UPDATE PRODUCT
   Any update sends product back to PENDING
   ========================================================= */
router.put("/:id", protect, upload.any(), async (req, res) => {
    try {
        const productId = req.params.id;

        const {
            title,
            price,
            stock,
            category,
            brand,
            description,
            image
        } = req.body;

        const userId =
            req.user?.id ||
            req.user?.userId ||
            req.user?._id;

        const userRole = String(
            req.user?.role || ""
        ).toLowerCase();

        if (!userId) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        /*
         * First check product exists.
         */
        const existing = await pool.query(
            `SELECT *
             FROM products
             WHERE id = $1`,
            [productId]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        const product = existing.rows[0];

        /*
         * Only admin or the product's merchant can update.
         */
        const isOwner =
            String(product.merchantId || "") === String(userId) ||
            String(product.createdBy || "") === String(userId);

        if (userRole !== "admin" && !isOwner) {
            return res.status(403).json({
                message: "You are not allowed to update this product"
            });
        }

        /*
         * Admin updates can remain approved.
         * Merchant updates require fresh approval.
         */
        const newApprovalStatus =
            userRole === "admin"
                ? "APPROVED"
                : "PENDING";

        const approvedBy =
            userRole === "admin"
                ? userId
                : null;

        const approvedAt =
            userRole === "admin"
                ? new Date()
                : null;

        const result = await pool.query(
            `UPDATE products
             SET title = $1,
                 price = $2,
                 stock = $3,
                 category = $4,
                 brand = $5,
                 description = $6,
                 image = $7,
                 "approvalStatus" = $8,
                 "rejectionReason" = NULL,
                 "approvedBy" = $9,
                 "approvedAt" = $10
             WHERE id = $11
             RETURNING *`,
            [
                title,
                price,
                stock || 0,
                category || null,
                brand || null,
                description || null,
                image || null,
                newApprovalStatus,
                approvedBy,
                approvedAt,
                productId
            ]
        );

        res.json({
            message:
                userRole === "admin"
                    ? "Product updated successfully"
                    : "Product updated and sent for admin approval",

            product: result.rows[0]
        });
    } catch (error) {
        console.error("Update product error:", error);

        res.status(500).json({
            message: "Failed to update product",
            error: error.message
        });
    }
});


/* =========================================================
   DELETE PRODUCT
   ========================================================= */
router.delete("/:id", protect, async (req, res) => {
    try {
        const productId = req.params.id;

        const userId =
            req.user?.id ||
            req.user?.userId ||
            req.user?._id;

        const userRole = String(
            req.user?.role || ""
        ).toLowerCase();

        if (!userId) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        /*
         * Check product owner.
         */
        const existing = await pool.query(
            `SELECT *
             FROM products
             WHERE id = $1`,
            [productId]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        const product = existing.rows[0];

        const isOwner =
            String(product.merchantId || "") === String(userId) ||
            String(product.createdBy || "") === String(userId);

        if (userRole !== "admin" && !isOwner) {
            return res.status(403).json({
                message: "You are not allowed to delete this product"
            });
        }

        /*
         * Remove related order items if the table exists.
         */
        try {
            await pool.query(
                `DELETE FROM order_items
                 WHERE product_id = $1`,
                [productId]
            );
        } catch (orderItemError) {
            console.log(
                "order_items cleanup skipped:",
                orderItemError.message
            );
        }

        const result = await pool.query(
            `DELETE FROM products
             WHERE id = $1
             RETURNING *`,
            [productId]
        );

        res.json({
            message: "Product deleted successfully",
            product: result.rows[0]
        });
    } catch (error) {
        console.error("Delete product error:", error);

        res.status(500).json({
            message: "Failed to delete product",
            error: error.message
        });
    }
});


module.exports = router;