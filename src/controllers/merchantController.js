const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/dashboard", async (req, res) => {
    try {
        const productCount = await pool.query("SELECT COUNT(*) FROM products");
        res.json({
            message: "Welcome to the Merchant Sell Board API",
            totalProducts: productCount.rows[0].count
        });
    } catch (error) {
        console.error("Merchant dashboard error:", error.message);
        res.status(500).json({ message: "Server error loading merchant dashboard" });
    }
});

module.exports = router;