const express = require("express");
const router = express.Router();
const Wishlist = require("../models/Wishlist");
const Product = require("../models/Product");

// 1. Add item to wishlist
router.post("/", async (req, res) => {
    try {
        const { userId, productId } = req.body;
        if (!userId || !productId) {
            return res.status(400).json({ success: false, error: "userId and productId are required" });
        }

        const [wishlistItem, created] = await Wishlist.findOrCreate({
            where: { userId, productId }
        });

        res.status(201).json({
            success: true,
            message: created ? "Added to wishlist" : "Item already in wishlist",
            data: wishlistItem
        });
    } catch (err) {
        console.error("Error adding to wishlist:", err);
        res.status(500).json({ success: false, error: "Server error" });
    }
});

// 2. Get user wishlist with product details
router.get("/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const wishlistItems = await Wishlist.findAll({ where: { userId } });
        const productIds = wishlistItems.map(item => item.productId);

        if (productIds.length === 0) {
            return res.status(200).json({ success: true, data: [] });
        }

        const products = await Product.findAll({ where: { id: productIds } });

        const combined = wishlistItems.map(w => {
            const prod = products.find(p => p.id === w.productId);
            return { wishlistId: w.id, ...(prod ? prod.toJSON() : {}) };
        });

        res.status(200).json({ success: true, data: combined });
    } catch (err) {
        console.error("Error fetching wishlist:", err);
        res.status(500).json({ success: false, error: "Server error" });
    }
});

// 3. Remove item from wishlist
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Wishlist.destroy({ where: { id } });

        if (!deleted) {
            return res.status(404).json({ success: false, error: "Wishlist item not found" });
        }

        res.status(200).json({ success: true, message: "Removed from wishlist" });
    } catch (err) {
        console.error("Error removing from wishlist:", err);
        res.status(500).json({ success: false, error: "Server error" });
    }
});

module.exports = router;