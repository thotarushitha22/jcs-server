const router = require("express").Router();
const multer = require("multer");
const { uploadImage } = require("../controllers/uploadController");
const { protect } = require("../middleware/auth");

// Memory storage — the file buffer is passed straight to Cloudinary,
// never written to disk (Render's filesystem isn't persistent anyway).
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per image
});

router.post("/", protect, upload.single("image"), uploadImage);

module.exports = router;