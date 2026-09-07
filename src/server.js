const express = require("express");
const cors = require("cors");
require("dotenv").config();

// =====================================================
// DATABASE
// =====================================================

require("./config/db");

// =====================================================
// MODELS
// =====================================================

require("./models/order");
require("./models/User");
require("./models/Product");
require("./models/Category");

// =====================================================
// ROUTES
// =====================================================

const authRoutes = require("./routes/authRoutes");
const merchantRoutes = require("./routes/merchantRoutes");
const productRoutes = require("./routes/productRoutes");
const adminRoutes = require("./routes/adminRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const orderRoutes = require("./routes/orderRoutes");

// =====================================================
// APP
// =====================================================

const app = express();

const PORT = process.env.PORT || 5000;

// =====================================================
// CORS
// =====================================================

const allowedOrigins = [
    // Local development
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:3000",

    // Customer frontend
    "https://jcs.thotarushitha22.workers.dev",

    // Admin / Merchant frontend
    "https://jcs-admin.thotarushitha22.workers.dev"
];

app.use(
    cors({
        origin: function (origin, callback) {
            // Allow requests without Origin
            // Example: Postman or server-to-server requests
            if (!origin) {
                return callback(null, true);
            }

            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            console.log("Blocked CORS origin:", origin);

            return callback(
                new Error(
                    "The CORS policy for this site does not allow access from the specified Origin."
                ),
                false
            );
        },

        credentials: true
    })
);

// =====================================================
// BODY PARSING
// =====================================================

app.use(
    express.json({
        limit: "50mb"
    })
);

app.use(
    express.urlencoded({
        limit: "50mb",
        extended: true
    })
);

// =====================================================
// API ROUTES
// =====================================================

// -----------------------------------------------------
// AUTHENTICATION
// -----------------------------------------------------

app.use(
    "/api/auth",
    authRoutes
);

// -----------------------------------------------------
// MERCHANT DASHBOARD
// -----------------------------------------------------

app.use(
    "/api/merchant",
    merchantRoutes
);

// -----------------------------------------------------
// PRODUCTS
// -----------------------------------------------------

app.use(
    "/api/products",
    productRoutes
);

// -----------------------------------------------------
// ADMIN
// -----------------------------------------------------

app.use(
    "/api/admin",
    adminRoutes
);

// -----------------------------------------------------
// CATEGORIES
// -----------------------------------------------------

app.use(
    "/api/categories",
    categoryRoutes
);

// -----------------------------------------------------
// ORDERS
// -----------------------------------------------------

app.use(
    "/api/orders",
    orderRoutes
);

// =====================================================
// HOME / HEALTH CHECK
// =====================================================

app.get("/", (req, res) => {
    res.json({
        message: "JCSGlobal E-Commerce API is running successfully!"
    });
});

// =====================================================
// API HEALTH CHECK
// =====================================================

app.get("/api", (req, res) => {
    res.json({
        message: "JCSGlobal API is running successfully!"
    });
});

// =====================================================
// 404 HANDLER
// =====================================================

app.use((req, res) => {
    console.log("404 Route:", req.method, req.originalUrl);

    res.status(404).json({
        message: "Route not found",
        path: req.originalUrl
    });
});

// =====================================================
// ERROR HANDLER
// =====================================================

app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);

    res.status(500).json({
        message: "Internal server error",

        error:
            process.env.NODE_ENV === "development"
                ? err.message
                : undefined
    });
});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {
    console.log("----------------------------------------");
    console.log("JCSGlobal Backend Started");
    console.log("----------------------------------------");

    console.log(`Server running on port ${PORT}`);

    console.log(
        `API: http://localhost:${PORT}/api`
    );

    console.log(
        `Products: http://localhost:${PORT}/api/products`
    );

    console.log(
        `Orders: http://localhost:${PORT}/api/orders`
    );

    console.log(
        `Merchant Products: http://localhost:${PORT}/api/products/my-products`
    );

    console.log("----------------------------------------");
});