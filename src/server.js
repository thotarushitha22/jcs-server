require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { connectDB, sequelize } = require("./config/db");

require("./models/User");
require("./models/Category");
require("./models/Product");
require("./models/Order");
require("./models/SellRequest");

const app = express();

// Updated CORS configuration to allow both local development and Netlify
app.use(cors({
    origin: [
        "http://localhost:5173",
        "https://jcs-g.netlify.app"
    ],
    credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
    res.json({ message: "JCSGlobal API is running." });
});

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/sell-requests", require("./routes/sellRequestRoutes"));

const start = async () => {
    await connectDB();
    await sequelize.sync({ alter: true });
    console.log("Database synced — all tables are ready.");

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

start();