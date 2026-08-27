const Product = require("../models/Product");

// @desc    Get merchant dashboard summary
// @route   GET /api/merchant/dashboard
const getMerchantDashboard = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const productsCount = await Product.countDocuments({ seller: userId });

        res.json({
            message: "Welcome to Merchant Dashboard",
            totalProducts: productsCount,
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch dashboard data", error: error.message });
    }
};

// @desc    Get merchant analytics
// @route   GET /api/merchant/analytics
const getMerchantAnalytics = async (req, res) => {
    try {
        res.json({ sales: 0, revenue: 0, views: 0 });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch analytics", error: error.message });
    }
};

// @desc    Update merchant settings
// @route   PUT /api/merchant/settings
const updateMerchantSettings = async (req, res) => {
    try {
        res.json({ message: "Settings updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Failed to update settings", error: error.message });
    }
};

module.exports = {
    getMerchantDashboard,
    getMerchantAnalytics,
    updateMerchantSettings,
};