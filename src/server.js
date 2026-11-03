const express = require("express");
const cors = require("cors");
require("dotenv").config();

// ===============================
// DATABASE
// ===============================
const { sequelize } = require("./config/db");

// ===============================
// MODELS
// ===============================
require("./models/Order");
require("./models/User");
require("./models/Product");
require("./models/Category");
require("./models/Wishlist");

// ===============================
// ROUTES
// ===============================
const authRoutes = require("./routes/authRoutes");
const merchantRoutes = require("./routes/merchantRoutes");
const productRoutes = require("./routes/productRoutes");
const adminRoutes = require("./routes/adminRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const chatRoutes = require("./routes/chatbot");

// ===============================
// APP
// ===============================
const app = express();
const PORT = process.env.PORT || 5000;

// ===============================
// CORS
// ===============================
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:3000",
    "https://jcs.thotarushitha22.workers.dev",
    "https://jcs-admin.thotarushitha22.workers.dev",
    "https://jcs-logistics.thotarushitha22.workers.dev",
    "https://jcs-delivery.thotarushitha22.workers.dev"
];

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            console.log("Blocked CORS origin:", origin);
            return callback(new Error("The CORS policy for this site does not allow access."), false);
        },
        credentials: true,
    })
);

// ===============================
// BODY PARSERS
// ===============================
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ===============================
// API ROUTES
// ===============================
app.use("/api/auth", authRoutes);
app.use("/api/merchant", merchantRoutes);
app.use("/api/products", productRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/chat", chatRoutes);

// ===============================
// HOME & HEALTH CHECK
// ===============================
app.get("/", (req, res) => {
    res.json({ success: true, message: "JCS Global API is running" });
});

app.get("/api", (req, res) => {
    res.json({
        success: true,
        message: "JCS Global API is running",
        routes: {
            auth: "/api/auth",
            merchant: "/api/merchant",
            products: "/api/products",
            admin: "/api/admin",
            categories: "/api/categories",
            orders: "/api/orders",
            payment: "/api/payment",
            wishlist: "/api/wishlist",
            chat: "/api/chat",
        },
    });
});

// ===============================
// 404 & ERROR HANDLERS
// ===============================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
        path: req.originalUrl,
    });
});

app.use((err, req, res, next) => {
    console.error("SERVER ERROR:", err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal server error",
    });
});

// ===============================
// START SERVER & SYNC DATABASE
// ===============================
app.listen(PORT, async () => {
    console.log("========================================");
    console.log("JCS GLOBAL SERVER");
    console.log("========================================");
    console.log(`Server running on port ${PORT}`);
    console.log(`API:     http://localhost:${PORT}/api`);
    console.log(`Payment: http://localhost:${PORT}/api/payment`);
    console.log("========================================");

    try {
        await sequelize.authenticate();
        console.log("PostgreSQL connected successfully to Neon!");

        // 🚨 FORCE UPDATE: This tells Neon to add 'delivery' to the ENUM
        await sequelize.sync({ alter: true });
        console.log("Database schema verified: constraints, roles, and tables resolved.");

    } catch (error) {
        console.error("Database connection failed:", error);
    }
});