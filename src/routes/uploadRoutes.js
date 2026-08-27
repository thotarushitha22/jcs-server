const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const { protect } = require("../middleware/auth");

// Storage Configuration
const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, "uploads/");
    },
    filename(req, file, cb) {
        cb(
            null,
            `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`
        );
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});

// Single file upload route
router.post("/", protect, upload.single("image"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
    }
    res.json({
        message: "Image uploaded successfully",
        url: `/${req.file.path.replace(/\\/g, "/")}`,
    });
});

module.exports = router;