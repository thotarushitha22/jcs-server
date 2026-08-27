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
        req.user = decoded;
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

const sellerOnly = (req, res, next) => {
    if (req.user?.role !== "seller") {
        return res.status(403).json({ message: "Sellers only" });
    }
    next();
};

module.exports = { protect, adminOnly, sellerOnly };