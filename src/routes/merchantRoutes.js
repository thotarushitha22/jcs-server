const router = require("express").Router();
const { protect } = require("../middleware/auth");
const Product = require("../models/Product");

router.post("/products", protect, async (req, res) => {
    try {
        if (req.user.role !== "seller") {
            return res.status(403).json({
                message: "Only merchants can use this route",
            });
        }

        const product = await Product.create({
            ...req.body,
            createdBy: req.user.id,
        });

        res.status(201).json(product);
    } catch (err) {
        console.error(err);

        res.status(400).json({
            message: "Failed to create merchant product",
            error: err.message,
        });
    }
});

module.exports = router;