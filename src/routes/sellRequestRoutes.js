const router = require("express").Router();
const { protect, adminOnly } = require("../middleware/auth");
const {
    createSellRequest,
    getSellRequests,
    getSellRequestById,
    updateSellRequestStatus,
} = require("../controllers/sellRequestController");

// Public/User endpoint
router.post("/", protect, createSellRequest);

// Admin-only endpoints
router.get("/", protect, adminOnly, getSellRequests);
router.get("/:id", protect, adminOnly, getSellRequestById);
router.put("/:id/status", protect, adminOnly, updateSellRequestStatus);

module.exports = router;