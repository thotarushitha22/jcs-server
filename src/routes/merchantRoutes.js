const express = require("express");
const router = express.Router();

// Add merchant endpoints here as needed
router.get("/dashboard", (req, res) => {
    res.json({ message: "Merchant route active" });
});

module.exports = router;