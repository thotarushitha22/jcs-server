const express = require("express");
const router = express.Router();

const dbPool = require("../config/db");
const pool = dbPool.pool || dbPool;

const multer = require("multer");
const { protect } = require("../middleware/auth");

const {
    detectProductColour
} = require("../services/colourDetectionService");

const storage = multer.memoryStorage();
const upload = multer({ storage });

/* =========================================================
   HELPER FUNCTIONS
   ========================================================= */

function getUserId(req) {
    return (
        req.user?.id ||
        req.user?.userId ||
        req.user?._id ||
        null
    );
}

function getUserRole(req) {
    return String(req.user?.role || "").toLowerCase();
}

function parseNumber(value, fallback = null) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return fallback;
    }

    const number = Number(value);

    return Number.isNaN(number)
        ? fallback
        : number;
}

function parseJsonField(value, fallback = null) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return fallback;
    }

    if (typeof value === "object") {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function parseArrayField(value) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return [];
    }

    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === "object") {
        return Array.isArray(value)
            ? value
            : [];
    }

    try {
        const parsed = JSON.parse(value);

        if (Array.isArray(parsed)) {
            return parsed;
        }

        return [];
    } catch {
        return String(value)
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    }
}

/* =========================================================
   NORMALIZE HIGHLIGHTS
   ========================================================= */

function normalizeHighlights(value) {
    if (!value) {
        return [];
    }

    let raw = value;

    if (typeof raw === "string") {
        try {
            raw = JSON.parse(raw);
        } catch {
            raw = raw
                .split(/\r?\n/)
                .map((item) => item.trim())
                .filter(Boolean);
        }
    }

    if (!Array.isArray(raw)) {
        return [];
    }

    return raw
        .map((item) => {
            if (typeof item === "string") {
                const text = item
                    .replace(/^[•●*-]\s*/, "")
                    .replace(/^\d+\.\s*/, "")
                    .trim();

                if (!text) {
                    return null;
                }

                return {
                    icon: "✓",
                    text
                };
            }

            if (
                item &&
                typeof item === "object"
            ) {
                const text = String(
                    item.text ||
                    item.value ||
                    item.highlight ||
                    ""
                ).trim();

                if (!text) {
                    return null;
                }

                return {
                    icon:
                        item.icon || "✓",
                    text
                };
            }

            return null;
        })
        .filter(Boolean);
}

/* =========================================================
   NORMALIZE PRODUCT IMAGES
   ========================================================= */

function normalizeImages(
    images,
    image
) {
    let result = parseArrayField(images);

    if (
        result.length === 0 &&
        image
    ) {
        result = [image];
    }

    return result
        .map((item) => {
            if (typeof item === "string") {
                return item.trim();
            }

            if (
                item &&
                typeof item === "object"
            ) {
                return (
                    item.url ||
                    item.secure_url ||
                    item.image ||
                    null
                );
            }

            return null;
        })
        .filter(Boolean);
}

/* =========================================================
   NORMALIZE VARIANTS
   ========================================================= */

function normalizeVariants(
    value,
    storage,
    colour
) {
    let variants =
        parseJsonField(value, {});

    if (
        !variants ||
        typeof variants !== "object" ||
        Array.isArray(variants)
    ) {
        variants = {};
    }

    const storageOptions =
        parseArrayField(storage);

    const colourOptions =
        parseArrayField(colour);

    return {
        ...variants,

        storage:
            Array.isArray(
                variants.storage
            ) &&
            variants.storage.length
                ? variants.storage
                : storageOptions,

        colors:
            Array.isArray(
                variants.colors
            ) &&
            variants.colors.length
                ? variants.colors
                : colourOptions
    };
}

/* =========================================================
   COLOUR HELPERS
   ========================================================= */

/*
 * Returns true when the merchant has entered
 * an actual colour.
 */
function hasManualColour(colour) {
    if (
        colour === undefined ||
        colour === null
    ) {
        return false;
    }

    const value =
        String(colour).trim();

    if (!value) {
        return false;
    }

    if (
        value.toLowerCase() ===
        "unavailable"
    ) {
        return false;
    }

    return true;
}

/*
 * Detect colour from product images.
 *
 * If no usable colour can be detected,
 * returns "Unavailable".
 */
async function getDetectedColour(
    images
) {
    try {
        if (
            !Array.isArray(images) ||
            images.length === 0
        ) {
            return {
                colour: "Unavailable",
                confidence: 0,
                sourceImage: null
            };
        }

        const result =
            await detectProductColour(
                images
            );

        if (
            !result ||
            !result.colour
        ) {
            return {
                colour: "Unavailable",
                confidence: 0,
                sourceImage: null
            };
        }

        return {
            colour:
            result.colour,
            confidence:
                result.confidence || 0,
            sourceImage:
                result.sourceImage ||
                null
        };
    } catch (error) {
        console.error(
            "Automatic colour detection error:",
            error
        );

        return {
            colour: "Unavailable",
            confidence: 0,
            sourceImage: null
        };
    }
}

/* =========================================================
   GET ALL APPROVED PRODUCTS
   CUSTOMER
   ========================================================= */

router.get("/", async (req, res) => {
    try {
        const result =
            await pool.query(
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
        console.error(
            "Get products error:",
            error
        );

        res.status(500).json({
            message:
                "Failed to fetch products",
            error: error.message
        });
    }
});

/* =========================================================
   GET MERCHANT PRODUCTS
   ========================================================= */

router.get(
    "/my-products",
    protect,
    async (req, res) => {
        try {
            const merchantId =
                getUserId(req);

            if (!merchantId) {
                return res.status(401).json({
                    message:
                        "Merchant ID is required"
                });
            }

            const result =
                await pool.query(
                    `SELECT *
                     FROM products
                     WHERE "merchantId" = $1
                        OR "createdBy" = $1
                     ORDER BY id DESC`,
                    [merchantId]
                );

            res.json(result.rows);
        } catch (error) {
            console.error(
                "Get merchant products error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch merchant products",
                error: error.message
            });
        }
    }
);

/* =========================================================
   ADMIN - GET ALL PRODUCTS
   ========================================================= */

router.get(
    "/admin/all",
    protect,
    async (req, res) => {
        try {
            const role =
                getUserRole(req);

            if (role !== "admin") {
                return res.status(403).json({
                    message:
                        "Admin access required"
                });
            }

            const result =
                await pool.query(
                    `SELECT *
                     FROM products
                     ORDER BY id DESC`
                );

            res.json(result.rows);
        } catch (error) {
            console.error(
                "Admin get products error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch all products",
                error: error.message
            });
        }
    }
);

/* =========================================================
   ADMIN - APPROVE PRODUCT
   ========================================================= */

router.put(
    "/admin/:id/approve",
    protect,
    async (req, res) => {
        try {
            const role =
                getUserRole(req);

            if (role !== "admin") {
                return res.status(403).json({
                    message:
                        "Admin access required"
                });
            }

            const productId =
                req.params.id;

            const approvedBy =
                getUserId(req);

            const result =
                await pool.query(
                    `UPDATE products
                     SET
                        "approvalStatus" = 'APPROVED',
                        "rejectionReason" = NULL,
                        "approvedBy" = $1,
                        "approvedAt" = CURRENT_TIMESTAMP
                     WHERE id = $2
                     RETURNING *`,
                    [
                        approvedBy,
                        productId
                    ]
                );

            if (
                result.rows.length === 0
            ) {
                return res.status(404).json({
                    message:
                        "Product not found"
                });
            }

            res.json({
                message:
                    "Product approved successfully",
                product:
                    result.rows[0]
            });
        } catch (error) {
            console.error(
                "Approve product error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to approve product",
                error: error.message
            });
        }
    }
);

/* =========================================================
   ADMIN - REJECT PRODUCT
   ========================================================= */

router.put(
    "/admin/:id/reject",
    protect,
    async (req, res) => {
        try {
            const role =
                getUserRole(req);

            if (role !== "admin") {
                return res.status(403).json({
                    message:
                        "Admin access required"
                });
            }

            const productId =
                req.params.id;

            const rejectionReason =
                req.body?.rejectionReason ||
                "Product rejected by administrator";

            const result =
                await pool.query(
                    `UPDATE products
                     SET
                        "approvalStatus" = 'REJECTED',
                        "rejectionReason" = $1,
                        "approvedBy" = NULL,
                        "approvedAt" = NULL
                     WHERE id = $2
                     RETURNING *`,
                    [
                        rejectionReason,
                        productId
                    ]
                );

            if (
                result.rows.length === 0
            ) {
                return res.status(404).json({
                    message:
                        "Product not found"
                });
            }

            res.json({
                message:
                    "Product rejected successfully",
                product:
                    result.rows[0]
            });
        } catch (error) {
            console.error(
                "Reject product error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to reject product",
                error: error.message
            });
        }
    }
);

/* =========================================================
   ONE-TIME BULK COLOUR DETECTION
   EXISTING PRODUCTS
   =========================================================

   POST:

   /api/products/detect-colours

   Header:

   x-colour-scan-secret:
   YOUR_SECRET

   Optional:

   ?overwrite=true

   Default behavior:
   - Existing real colour is preserved.
   - Empty/Unavailable colour is detected.
   - Products without images become Unavailable.

   overwrite=true:
   - Re-analyzes all products with images.
   ========================================================= */

router.post(
    "/detect-colours",
    protect,
    async (req, res) => {
        try {
            const role =
                getUserRole(req);

            /*
             * Only admin can run the
             * complete catalog scan.
             */
            if (role !== "admin") {
                return res.status(403).json({
                    message:
                        "Admin access required"
                });
            }

            const scanSecret =
                req.headers[
                    "x-colour-scan-secret"
                    ];

            const expectedSecret =
                process.env.COLOUR_SCAN_SECRET;

            if (
                !expectedSecret ||
                !scanSecret ||
                scanSecret !==
                expectedSecret
            ) {
                return res.status(401).json({
                    message:
                        "Invalid colour scan secret"
                });
            }

            const overwrite =
                String(
                    req.query.overwrite || ""
                ).toLowerCase() ===
                "true";

            const products =
                await pool.query(
                    `SELECT
                        id,
                        title,
                        colour,
                        images,
                        image
                     FROM products
                     ORDER BY id ASC`
                );

            let scanned = 0;
            let updated = 0;
            let skipped = 0;
            let failed = 0;

            const results = [];

            for (
                const product
                of products.rows
                ) {
                try {
                    const images =
                        normalizeImages(
                            product.images,
                            product.image
                        );

                    /*
                     * No image.
                     */
                    if (
                        images.length === 0
                    ) {
                        if (
                            !hasManualColour(
                                product.colour
                            ) ||
                            overwrite
                        ) {
                            await pool.query(
                                `UPDATE products
                                 SET colour = $1
                                 WHERE id = $2`,
                                [
                                    "Unavailable",
                                    product.id
                                ]
                            );

                            updated++;

                            results.push({
                                id:
                                product.id,
                                title:
                                product.title,
                                status:
                                    "UPDATED",
                                colour:
                                    "Unavailable",
                                reason:
                                    "No images"
                            });
                        } else {
                            skipped++;

                            results.push({
                                id:
                                product.id,
                                title:
                                product.title,
                                status:
                                    "SKIPPED",
                                colour:
                                product.colour,
                                reason:
                                    "Manual colour already exists"
                            });
                        }

                        continue;
                    }

                    /*
                     * Preserve manually entered
                     * colour unless overwrite=true.
                     */
                    if (
                        !overwrite &&
                        hasManualColour(
                            product.colour
                        )
                    ) {
                        skipped++;

                        results.push({
                            id:
                            product.id,
                            title:
                            product.title,
                            status:
                                "SKIPPED",
                            colour:
                            product.colour,
                            reason:
                                "Colour already exists"
                        });

                        continue;
                    }

                    scanned++;

                    console.log(
                        `Colour scan: ${product.id} - ${product.title}`
                    );

                    const detection =
                        await getDetectedColour(
                            images
                        );

                    const detectedColour =
                        detection.colour ||
                        "Unavailable";

                    await pool.query(
                        `UPDATE products
                         SET colour = $1
                         WHERE id = $2`,
                        [
                            detectedColour,
                            product.id
                        ]
                    );

                    updated++;

                    results.push({
                        id:
                        product.id,
                        title:
                        product.title,
                        status:
                            "UPDATED",
                        colour:
                        detectedColour,
                        confidence:
                        detection.confidence,
                        sourceImage:
                        detection.sourceImage
                    });

                    console.log(
                        `Result: ${detectedColour}`
                    );
                } catch (
                    productError
                    ) {
                    failed++;

                    console.error(
                        `Colour detection failed for product ${product.id}:`,
                        productError
                    );

                    results.push({
                        id:
                        product.id,
                        title:
                        product.title,
                        status:
                            "FAILED",
                        error:
                        productError.message
                    });
                }
            }

            return res.json({
                message:
                    "Bulk colour detection completed",

                summary: {
                    totalProducts:
                    products.rows.length,
                    scanned,
                    updated,
                    skipped,
                    failed
                },

                results
            });
        } catch (error) {
            console.error(
                "Bulk colour detection error:",
                error
            );

            res.status(500).json({
                message:
                    "Bulk colour detection failed",
                error: error.message
            });
        }
    }
);

/* =========================================================
   GET SINGLE APPROVED PRODUCT
   CUSTOMER PRODUCT DETAILS
   ========================================================= */

router.get(
    "/:id",
    async (req, res) => {
        try {
            const productId =
                req.params.id;

            const result =
                await pool.query(
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

            if (
                result.rows.length === 0
            ) {
                return res.status(404).json({
                    message:
                        "Product not found"
                });
            }

            const product =
                result.rows[0];

            /*
             * Make sure the frontend always
             * receives a usable colour.
             */
            if (
                !product.colour ||
                !String(
                    product.colour
                ).trim()
            ) {
                product.colour =
                    "Unavailable";
            }

            res.json(product);
        } catch (error) {
            console.error(
                "Get product error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to fetch product",
                error: error.message
            });
        }
    }
);

/* =========================================================
   CREATE PRODUCT
   MERCHANT
   ========================================================= */

router.post(
    "/",
    protect,
    upload.any(),
    async (req, res) => {
        try {
            const userId =
                getUserId(req);

            const userRole =
                getUserRole(req);

            if (!userId) {
                return res.status(401).json({
                    message:
                        "User authentication required"
                });
            }

            const {
                title,
                brand,
                sku,
                model,

                price,
                mrp,
                stock,
                moq,
                gstPercent,

                categoryId,

                overview,
                description,
                warranty,

                highlights,

                colour,
                storage,
                ram,
                processor,
                battery,
                networkGen,
                simSlots,
                screenSize,
                rearCamera,
                frontCamera,
                securityFeatures,
                weight,
                waterResistant,
                fastCharging,

                images,
                image,

                variants,

                merchantId
            } = req.body;

            /* -------------------------------------------------
               VALIDATION
               ------------------------------------------------- */

            if (
                !title ||
                !String(title).trim()
            ) {
                return res.status(400).json({
                    message:
                        "Product title is required"
                });
            }

            if (
                price === undefined ||
                price === null ||
                price === "" ||
                Number(price) <= 0
            ) {
                return res.status(400).json({
                    message:
                        "A valid product price is required"
                });
            }

            /* -------------------------------------------------
               APPROVAL
               ------------------------------------------------- */

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

            /* -------------------------------------------------
               MERCHANT
               ------------------------------------------------- */

            const finalMerchantId =
                userRole === "admin"
                    ? merchantId || null
                    : userId;

            /* -------------------------------------------------
               NORMALIZE
               ------------------------------------------------- */

            const normalizedHighlights =
                normalizeHighlights(
                    highlights
                );

            const normalizedImages =
                normalizeImages(
                    images,
                    image
                );

            const normalizedVariants =
                normalizeVariants(
                    variants,
                    storage,
                    colour
                );

            /* -------------------------------------------------
               CATEGORY
               ------------------------------------------------- */

            const finalCategoryId =
                categoryId ===
                undefined ||
                categoryId === null ||
                categoryId === "" ||
                Number.isNaN(
                    Number(categoryId)
                )
                    ? null
                    : Number(categoryId);

            /* -------------------------------------------------
               AUTOMATIC COLOUR DETECTION
               -------------------------------------------------

               Manual colour wins.

               If merchant leaves colour empty:
               analyze uploaded images.
               ------------------------------------------------- */

            let finalColour = null;
            let colourDetection = null;

            if (
                hasManualColour(colour)
            ) {
                finalColour =
                    String(
                        colour
                    ).trim();
            } else if (
                normalizedImages.length > 0
            ) {
                colourDetection =
                    await getDetectedColour(
                        normalizedImages
                    );

                finalColour =
                    colourDetection.colour;
            } else {
                finalColour =
                    "Unavailable";
            }

            /* -------------------------------------------------
               INSERT
               ------------------------------------------------- */

            const result =
                await pool.query(
                    `INSERT INTO products
                    (
                        title,
                        brand,
                        sku,
                        model,

                        price,
                        mrp,
                        stock,
                        moq,
                        "gstPercent",

                        "categoryId",

                        overview,
                        description,
                        warranty,

                        highlights,

                        colour,
                        storage,
                        ram,
                        processor,
                        battery,
                        "networkGen",
                        "simSlots",
                        "screenSize",
                        "rearCamera",
                        "frontCamera",
                        "securityFeatures",
                        weight,
                        "waterResistant",
                        "fastCharging",

                        images,
                        variants,

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

                        $11,
                        $12,
                        $13,

                        $14,

                        $15,
                        $16,
                        $17,
                        $18,
                        $19,
                        $20,
                        $21,
                        $22,
                        $23,
                        $24,
                        $25,
                        $26,
                        $27,
                        $28,

                        $29,
                        $30,

                        $31,
                        $32,

                        $33,
                        NULL,
                        $34,
                        $35
                    )
                    RETURNING *`,
                    [
                        String(
                            title
                        ).trim(),

                        brand
                            ? String(
                                brand
                            ).trim()
                            : null,

                        sku
                            ? String(
                                sku
                            ).trim()
                            : null,

                        model
                            ? String(
                                model
                            ).trim()
                            : null,

                        parseNumber(
                            price,
                            0
                        ),

                        parseNumber(
                            mrp,
                            parseNumber(
                                price,
                                0
                            )
                        ),

                        parseNumber(
                            stock,
                            0
                        ),

                        parseNumber(
                            moq,
                            1
                        ),

                        parseNumber(
                            gstPercent,
                            18
                        ),

                        finalCategoryId,

                        overview
                            ? String(
                                overview
                            ).trim()
                            : null,

                        description
                            ? String(
                                description
                            ).trim()
                            : overview
                                ? String(
                                    overview
                                ).trim()
                                : null,

                        warranty
                            ? String(
                                warranty
                            ).trim()
                            : null,

                        JSON.stringify(
                            normalizedHighlights
                        ),

                        /*
                         * AUTOMATICALLY
                         * DETECTED COLOUR
                         */
                        finalColour,

                        storage
                            ? String(
                                storage
                            ).trim()
                            : null,

                        ram
                            ? String(
                                ram
                            ).trim()
                            : null,

                        processor
                            ? String(
                                processor
                            ).trim()
                            : null,

                        battery
                            ? String(
                                battery
                            ).trim()
                            : null,

                        networkGen
                            ? String(
                                networkGen
                            ).trim()
                            : null,

                        simSlots
                            ? String(
                                simSlots
                            ).trim()
                            : null,

                        screenSize
                            ? String(
                                screenSize
                            ).trim()
                            : null,

                        rearCamera
                            ? String(
                                rearCamera
                            ).trim()
                            : null,

                        frontCamera
                            ? String(
                                frontCamera
                            ).trim()
                            : null,

                        securityFeatures
                            ? String(
                                securityFeatures
                            ).trim()
                            : null,

                        weight
                            ? String(
                                weight
                            ).trim()
                            : null,

                        waterResistant
                            ? String(
                                waterResistant
                            ).trim()
                            : null,

                        fastCharging
                            ? String(
                                fastCharging
                            ).trim()
                            : null,

                        JSON.stringify(
                            normalizedImages
                        ),

                        JSON.stringify(
                            normalizedVariants
                        ),

                        finalMerchantId,

                        userId,

                        approvalStatus,

                        approvedBy,

                        approvedAt
                    ]
                );

            res.status(201).json({
                message:
                    approvalStatus ===
                    "PENDING"
                        ? "Product submitted for admin approval"
                        : "Product created successfully",

                product:
                    result.rows[0],

                colourDetection: {
                    colour:
                    finalColour,

                    source:
                        hasManualColour(
                            colour
                        )
                            ? "merchant"
                            : "image",

                    confidence:
                        colourDetection?.confidence ||
                        0,

                    sourceImage:
                        colourDetection?.sourceImage ||
                        null
                }
            });
        } catch (error) {
            console.error(
                "Create product error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to create product",
                error:
                error.message
            });
        }
    }
);

/* =========================================================
   UPDATE PRODUCT
   MERCHANT / ADMIN
   ========================================================= */

router.put(
    "/:id",
    protect,
    upload.any(),
    async (req, res) => {
        try {
            const productId =
                req.params.id;

            const userId =
                getUserId(req);

            const userRole =
                getUserRole(req);

            if (!userId) {
                return res.status(401).json({
                    message:
                        "Authentication required"
                });
            }

            /* -------------------------------------------------
               FIND EXISTING PRODUCT
               ------------------------------------------------- */

            const existing =
                await pool.query(
                    `SELECT *
                     FROM products
                     WHERE id = $1`,
                    [productId]
                );

            if (
                existing.rows.length === 0
            ) {
                return res.status(404).json({
                    message:
                        "Product not found"
                });
            }

            const product =
                existing.rows[0];

            /* -------------------------------------------------
               OWNERSHIP
               ------------------------------------------------- */

            const isOwner =
                String(
                    product.merchantId ||
                    ""
                ) ===
                String(userId) ||
                String(
                    product.createdBy ||
                    ""
                ) ===
                String(userId);

            if (
                userRole !== "admin" &&
                !isOwner
            ) {
                return res.status(403).json({
                    message:
                        "You are not allowed to update this product"
                });
            }

            const {
                title,
                brand,
                sku,
                model,

                price,
                mrp,
                stock,
                moq,
                gstPercent,

                categoryId,

                overview,
                description,
                warranty,

                highlights,

                colour,
                storage,
                ram,
                processor,
                battery,
                networkGen,
                simSlots,
                screenSize,
                rearCamera,
                frontCamera,
                securityFeatures,
                weight,
                waterResistant,
                fastCharging,

                images,
                image,

                variants
            } = req.body;

            /* -------------------------------------------------
               VALIDATION
               ------------------------------------------------- */

            if (
                !title ||
                !String(title).trim()
            ) {
                return res.status(400).json({
                    message:
                        "Product title is required"
                });
            }

            if (
                price === undefined ||
                price === null ||
                price === "" ||
                Number(price) <= 0
            ) {
                return res.status(400).json({
                    message:
                        "A valid product price is required"
                });
            }

            /* -------------------------------------------------
               IMAGES
               ------------------------------------------------- */

            let normalizedImages;

            if (
                images !== undefined ||
                image !== undefined
            ) {
                normalizedImages =
                    normalizeImages(
                        images,
                        image
                    );
            } else {
                normalizedImages =
                    normalizeImages(
                        product.images,
                        product.image
                    );
            }

            /*
             * IMPORTANT:
             *
             * If frontend sends an empty image array
             * accidentally, preserve existing images.
             */
            if (
                normalizedImages.length === 0 &&
                !images &&
                !image
            ) {
                normalizedImages =
                    normalizeImages(
                        product.images,
                        product.image
                    );
            }

            /* -------------------------------------------------
               HIGHLIGHTS
               ------------------------------------------------- */

            const normalizedHighlights =
                highlights !== undefined
                    ? normalizeHighlights(
                        highlights
                    )
                    : normalizeHighlights(
                        product.highlights
                    );

            /* -------------------------------------------------
               VARIANTS
               ------------------------------------------------- */

            const normalizedVariants =
                normalizeVariants(
                    variants !== undefined
                        ? variants
                        : product.variants,

                    storage !== undefined
                        ? storage
                        : product.storage,

                    colour !== undefined
                        ? colour
                        : product.colour
                );

            /* -------------------------------------------------
               CATEGORY
               ------------------------------------------------- */

            const finalCategoryId =
                categoryId ===
                undefined ||
                categoryId === null ||
                categoryId === "" ||
                Number.isNaN(
                    Number(categoryId)
                )
                    ? product.categoryId ||
                    null
                    : Number(categoryId);

            /* -------------------------------------------------
               AUTOMATIC COLOUR
               ------------------------------------------------- */

            let finalColour = null;
            let colourDetection = null;

            /*
             * If merchant entered a colour,
             * preserve it.
             */
            if (
                hasManualColour(colour)
            ) {
                finalColour =
                    String(
                        colour
                    ).trim();
            }

            /*
             * If colour is empty AND there are images,
             * detect automatically.
             */
            else if (
                normalizedImages.length > 0
            ) {
                colourDetection =
                    await getDetectedColour(
                        normalizedImages
                    );

                finalColour =
                    colourDetection.colour;
            }

            /*
             * If image detection fails,
             * preserve an existing manual colour.
             */
            else if (
                hasManualColour(
                    product.colour
                )
            ) {
                finalColour =
                    product.colour;
            }

            /*
             * Nothing available.
             */
            else {
                finalColour =
                    "Unavailable";
            }

            /* -------------------------------------------------
               APPROVAL
               ------------------------------------------------- */

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

            /* -------------------------------------------------
               UPDATE
               ------------------------------------------------- */

            const result =
                await pool.query(
                    `UPDATE products
                     SET
                        title = $1,
                        brand = $2,
                        sku = $3,
                        model = $4,

                        price = $5,
                        mrp = $6,
                        stock = $7,
                        moq = $8,
                        "gstPercent" = $9,

                        "categoryId" = $10,

                        overview = $11,
                        description = $12,
                        warranty = $13,

                        highlights = $14,

                        colour = $15,
                        storage = $16,
                        ram = $17,
                        processor = $18,
                        battery = $19,
                        "networkGen" = $20,
                        "simSlots" = $21,
                        "screenSize" = $22,
                        "rearCamera" = $23,
                        "frontCamera" = $24,
                        "securityFeatures" = $25,
                        weight = $26,
                        "waterResistant" = $27,
                        "fastCharging" = $28,

                        images = $29,
                        variants = $30,

                        "approvalStatus" = $31,
                        "rejectionReason" = NULL,
                        "approvedBy" = $32,
                        "approvedAt" = $33

                     WHERE id = $34

                     RETURNING *`,
                    [
                        String(
                            title
                        ).trim(),

                        brand
                            ? String(
                                brand
                            ).trim()
                            : null,

                        sku
                            ? String(
                                sku
                            ).trim()
                            : null,

                        model
                            ? String(
                                model
                            ).trim()
                            : null,

                        parseNumber(
                            price,
                            0
                        ),

                        parseNumber(
                            mrp,
                            parseNumber(
                                price,
                                0
                            )
                        ),

                        parseNumber(
                            stock,
                            0
                        ),

                        parseNumber(
                            moq,
                            1
                        ),

                        parseNumber(
                            gstPercent,
                            18
                        ),

                        finalCategoryId,

                        overview
                            ? String(
                                overview
                            ).trim()
                            : null,

                        description
                            ? String(
                                description
                            ).trim()
                            : overview
                                ? String(
                                    overview
                                ).trim()
                                : null,

                        warranty
                            ? String(
                                warranty
                            ).trim()
                            : null,

                        JSON.stringify(
                            normalizedHighlights
                        ),

                        finalColour,

                        storage
                            ? String(
                                storage
                            ).trim()
                            : null,

                        ram
                            ? String(
                                ram
                            ).trim()
                            : null,

                        processor
                            ? String(
                                processor
                            ).trim()
                            : null,

                        battery
                            ? String(
                                battery
                            ).trim()
                            : null,

                        networkGen
                            ? String(
                                networkGen
                            ).trim()
                            : null,

                        simSlots
                            ? String(
                                simSlots
                            ).trim()
                            : null,

                        screenSize
                            ? String(
                                screenSize
                            ).trim()
                            : null,

                        rearCamera
                            ? String(
                                rearCamera
                            ).trim()
                            : null,

                        frontCamera
                            ? String(
                                frontCamera
                            ).trim()
                            : null,

                        securityFeatures
                            ? String(
                                securityFeatures
                            ).trim()
                            : null,

                        weight
                            ? String(
                                weight
                            ).trim()
                            : null,

                        waterResistant
                            ? String(
                                waterResistant
                            ).trim()
                            : null,

                        fastCharging
                            ? String(
                                fastCharging
                            ).trim()
                            : null,

                        JSON.stringify(
                            normalizedImages
                        ),

                        JSON.stringify(
                            normalizedVariants
                        ),

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

                product:
                    result.rows[0],

                colourDetection: {
                    colour:
                    finalColour,

                    source:
                        hasManualColour(
                            colour
                        )
                            ? "merchant"
                            : "image",

                    confidence:
                        colourDetection?.confidence ||
                        0,

                    sourceImage:
                        colourDetection?.sourceImage ||
                        null
                }
            });
        } catch (error) {
            console.error(
                "Update product error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to update product",
                error:
                error.message
            });
        }
    }
);

/* =========================================================
   DELETE PRODUCT
   ========================================================= */

router.delete(
    "/:id",
    protect,
    async (req, res) => {
        try {
            const productId =
                req.params.id;

            const userId =
                getUserId(req);

            const userRole =
                getUserRole(req);

            if (!userId) {
                return res.status(401).json({
                    message:
                        "Authentication required"
                });
            }

            const existing =
                await pool.query(
                    `SELECT *
                     FROM products
                     WHERE id = $1`,
                    [productId]
                );

            if (
                existing.rows.length === 0
            ) {
                return res.status(404).json({
                    message:
                        "Product not found"
                });
            }

            const product =
                existing.rows[0];

            const isOwner =
                String(
                    product.merchantId ||
                    ""
                ) ===
                String(userId) ||
                String(
                    product.createdBy ||
                    ""
                ) ===
                String(userId);

            if (
                userRole !== "admin" &&
                !isOwner
            ) {
                return res.status(403).json({
                    message:
                        "You are not allowed to delete this product"
                });
            }

            /*
             * Try to remove order items.
             */
            try {
                await pool.query(
                    `DELETE FROM order_items
                     WHERE product_id = $1`,
                    [productId]
                );
            } catch (
                orderItemError
                ) {
                console.log(
                    "order_items cleanup skipped:",
                    orderItemError.message
                );
            }

            const result =
                await pool.query(
                    `DELETE FROM products
                     WHERE id = $1
                     RETURNING *`,
                    [productId]
                );

            res.json({
                message:
                    "Product deleted successfully",

                product:
                    result.rows[0]
            });
        } catch (error) {
            console.error(
                "Delete product error:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to delete product",
                error: error.message
            });
        }
    }
);

/* =========================================================
   EXPORT
   ========================================================= */

module.exports = router;