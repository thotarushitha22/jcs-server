const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Import Routes
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const merchantRoutes = require("./routes/merchantRoutes");
const orderRoutes = require("./routes/orderRoutes");
const productRoutes = require("./routes/productRoutes");
const sellRequestRoutes = require("./routes/sellRequestRoutes");
const uploadRoutes = require("./routes/uploadRoutes");

// Register Routes (Line 25 area)
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/merchant", merchantRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sell-requests", sellRequestRoutes);
app.use("/api/upload", uploadRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});