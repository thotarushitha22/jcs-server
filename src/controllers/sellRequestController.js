const SellRequest = require("../models/SellRequest"); // Adjust model path if needed

// @desc    Submit a new merchant/seller request
// @route   POST /api/sell-requests
const createSellRequest = async (req, res) => {
    try {
        const { storeName, businessType, phone, address, taxId } = req.body;
        const userId = req.user.id || req.user._id;

        const existingRequest = await SellRequest.findOne({ user: userId, status: "Pending" });
        if (existingRequest) {
            return res.status(400).json({ message: "You already have a pending merchant request." });
        }

        const sellRequest = await SellRequest.create({
            user: userId,
            storeName,
            businessType,
            phone,
            address,
            taxId,
            status: "Pending",
        });

        res.status(201).json(sellRequest);
    } catch (error) {
        res.status(500).json({ message: "Failed to submit sell request", error: error.message });
    }
};

// @desc    Get all sell requests (Admin)
// @route   GET /api/sell-requests
const getSellRequests = async (req, res) => {
    try {
        const requests = await SellRequest.find().populate("user", "name email");
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch sell requests", error: error.message });
    }
};

// @desc    Get single sell request by ID (Admin)
// @route   GET /api/sell-requests/:id
const getSellRequestById = async (req, res) => {
    try {
        const request = await SellRequest.findById(req.params.id).populate("user", "name email");
        if (!request) {
            return res.status(404).json({ message: "Sell request not found" });
        }
        res.json(request);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch sell request", error: error.message });
    }
};

// @desc    Approve or reject a sell request (Admin)
// @route   PUT /api/sell-requests/:id/status
const updateSellRequestStatus = async (req, res) => {
    try {
        const { status } = req.body; // "Approved" or "Rejected"
        const request = await SellRequest.findById(req.params.id);

        if (!request) {
            return res.status(404).json({ message: "Sell request not found" });
        }

        request.status = status || request.status;
        await request.save();

        res.json({ message: `Sell request status updated to ${request.status}`, request });
    } catch (error) {
        res.status(500).json({ message: "Failed to update sell request status", error: error.message });
    }
};

module.exports = {
    createSellRequest,
    getSellRequests,
    getSellRequestById,
    updateSellRequestStatus,
};