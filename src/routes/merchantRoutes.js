const router = require("express").Router();
const { protect, sellerOnly } = require("../middleware/auth");
const {
    getMerchantDashboard,
    getMerchantAnalytics,
    updateMerchantSettings,
} = require("../controllers/merchantController"); // Adjust relative path if needed

router.get("/dashboard", protect, sellerOnly, getMerchantDashboard);
router.get("/analytics", protect, sellerOnly, getMerchantAnalytics);
router.put("/settings", protect, sellerOnly, updateMerchantSettings);

module.exports = router;