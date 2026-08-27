const cloudinary = require("../config/cloudinary");

// POST /api/upload  (protected — any logged-in seller/admin)
// Expects a multipart/form-data request with a field named "image".
exports.uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No image file provided" });
        }

        // req.file.buffer holds the raw image data (using multer's memory storage).
        // We upload that buffer straight to Cloudinary as a base64 data URI.
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        const dataUri = `data:${req.file.mimetype};base64,${b64}`;

        const result = await cloudinary.uploader.upload(dataUri, {
            folder: "jcsglobal-products",
        });

        res.json({ url: result.secure_url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Image upload failed", error: err.message });
    }
};