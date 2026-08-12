const router = require("express").Router();
const {
    createSellRequest,
    getMySellRequests,
    getAllSellRequests,
    updateSellRequestStatus,
} = require("../controllers/sellRequestController");
const { protect, adminOnly } = require("../middleware/auth");

router.post("/", protect, createSellRequest);
router.get("/", protect, getMySellRequests);
router.get("/all", protect, adminOnly, getAllSellRequests);
router.put("/:id/status", protect, adminOnly, updateSellRequestStatus);

module.exports = router;