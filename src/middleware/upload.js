const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "jcs-global/products",
        allowed_formats: ["jpg", "jpeg", "png", "webp", "svg"],
        resource_type: "auto",
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
});

module.exports = upload;