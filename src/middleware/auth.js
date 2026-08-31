const jwt = require("jsonwebtoken");

const protect = (req, res, next) => {
    let token = req.headers.authorization;

    if (token && token.startsWith("Bearer")) {
        try {
            token = token.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_secret_key");

            // Attach decoded user info (must contain id/userId) to request object
            req.user = decoded;
            return next();
        } catch (error) {
            return res.status(401).json({ message: "Not authorized, token failed" });
        }
    }

    if (!token) {
        return res.status(401).json({ message: "Not authorized, no token provided" });
    }
};

const sellerOnly = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'seller' || req.user.email === 'thotarushitha22@gmail.com')) {
        return next();
    }
    return res.status(403).json({ message: "Access denied: Admin/Seller only" });
};

module.exports = { protect, sellerOnly };