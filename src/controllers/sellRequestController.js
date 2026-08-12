const SellRequest = require("../models/SellRequest");

// POST /api/sell-requests  (logged-in seller)
exports.createSellRequest = async (req, res) => {
    try {
        const { productName, category, quantity, expectedPrice, images, kycDocument } = req.body;
        const request = await SellRequest.create({
            sellerId: req.user.id,
            productName,
            category,
            quantity,
            expectedPrice,
            images,
            kycDocument,
        });
        res.status(201).json(request);
    } catch (err) {
        res.status(400).json({ message: "Failed to submit sell request", error: err.message });
    }
};

// GET /api/sell-requests  (logged-in seller's own requests)
exports.getMySellRequests = async (req, res) => {
    try {
        const requests = await SellRequest.findAll({
            where: { sellerId: req.user.id },
            order: [["createdAt", "DESC"]],
        });
        res.json(requests);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch sell requests", error: err.message });
    }
};

// GET /api/sell-requests/all  (admin only — review queue)
exports.getAllSellRequests = async (req, res) => {
    try {
        const requests = await SellRequest.findAll({ order: [["createdAt", "DESC"]] });
        res.json(requests);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch sell requests", error: err.message });
    }
};

// PUT /api/sell-requests/:id/status  (admin only — approve/reject)
exports.updateSellRequestStatus = async (req, res) => {
    try {
        const request = await SellRequest.findByPk(req.params.id);
        if (!request) return res.status(404).json({ message: "Sell request not found" });
        request.status = req.body.status;
        await request.save();
        res.json(request);
    } catch (err) {
        res.status(400).json({ message: "Failed to update sell request", error: err.message });
    }
};