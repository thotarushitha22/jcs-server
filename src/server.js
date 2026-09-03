const express = require("express");
const cors = require("cors");
require("dotenv").config();

// 1. Initialize Database connection
require("./config/db");

// 2. Explicitly require models so they register cleanly
require("./models/order");
require("./models/User");
require("./models/Product");

const authRoutes = require("./routes/authRoutes");
const merchantRoutes = require("./routes/merchantRoutes");
const productRoutes = require("./routes/productRoutes");
const adminRoutes = require("./routes/adminRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const orderRoutes = require("./routes/orderRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Allowed frontend origins (added http://localhost:5175)
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:3000",

    // Cloudflare frontends
    "https://jcs-admin.thotarushitha22.workers.dev",
    "https://jcs.thotarushitha22.workers.dev"
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, Postman, or server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true
}));

// INCREASE PAYLOAD LIMIT (supports large image/KYC payloads)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/merchant", merchantRoutes);
app.use("/api/merchant", productRoutes);  // Catches /api/merchant/products requests
app.use("/api/products", productRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);

app.get("/", (req, res) => {
    res.json({ message: "JCSGlobal E-Commerce API is running successfully!" });
});

app.use((err, req, res, next) => {
    console.error("Unhandled error stack:", err.stack);
    res.status(500).json({
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" ? err.message : undefined
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});