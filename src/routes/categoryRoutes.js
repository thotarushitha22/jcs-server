const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
    res.json([
        { id: "smartphones", name: "Smartphones" },
        { id: "laptops", name: "Laptops" },
        { id: "tvs", name: "TVs" },
        { id: "accessories", name: "Accessories" }
    ]);
});

module.exports = router;