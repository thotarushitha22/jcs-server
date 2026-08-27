const router = require("express").Router();
const { protect } = require("../middleware/auth");
const {
    registerUser,
    loginUser,
    getMe,
    updateProfile,
} = require("../controllers/authController");

// Line 10 (now clean and guarded against undefined functions)
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);

module.exports = router;