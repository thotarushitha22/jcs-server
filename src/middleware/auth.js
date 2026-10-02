const jwt = require("jsonwebtoken");

const protect = (req, res, next) => {
    const token = req.headers.authorization?.startsWith("Bearer")
        ? req.headers.authorization.split(" ")[1]
        : req.cookies?.token;

    if (!token) {
        return res.status(401).json({ message: "Not authorized — no token provided" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { id, role }
        next();
    } catch (err) {
        res.status(401).json({ message: "Not authorized — invalid or expired token" });
    }
};

const adminOnly = (req, res, next) => {
    if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "Admins only" });
    }
    next();
};

// Admins and merchants/sellers. Used for order status updates;
// the controller then limits what a merchant is allowed to set.
const adminOrMerchant = (req, res, next) => {
    const role = String(req.user?.role || "").toLowerCase();
    if (!["admin", "merchant", "seller"].includes(role)) {
        return res.status(403).json({ message: "Admins or merchants only" });
    }
    next();
};

module.exports = { protect, adminOnly, adminOrMerchant };