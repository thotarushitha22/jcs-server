const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");

const genToken = (user) =>
    jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

const publicUser = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    kycStatus: user.kycStatus,
    gstNumber: user.gstNumber,
});

// POST /api/auth/register
exports.register = async (req, res) => {
    try {
        const { name, email, password, phone, role, gstNumber } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email, and password are required" });
        }

        const existing = await User.findOne({ where: { email } });
        if (existing) {
            return res.status(400).json({ message: "An account with that email already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            phone,
            role: role === "seller" ? "seller" : "buyer",
            gstNumber,
        });

        const token = genToken(user);
        res.status(201).json({ token, user: publicUser(user) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Registration failed", error: err.message });
    }
};

// POST /api/auth/login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        const token = genToken(user);
        res.json({ token, user: publicUser(user) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Login failed", error: err.message });
    }
};

// GET /api/auth/me  (requires the `protect` middleware)
exports.getMe = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json({ user: publicUser(user) });
    } catch (err) {
        res.status(500).json({ message: "Could not fetch user", error: err.message });
    }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Please provide an email address" });
        }

        const user = await User.findOne({ where: { email } });

        if (!user) {
            return res.status(200).json({
                message: "If that email is registered, password reset instructions have been sent."
            });
        }

        const resetToken = crypto.randomBytes(32).toString("hex");

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // Valid for 15 minutes
        await user.save();

        // Check your backend terminal window for this log to test token functionality directly
        console.log(`🔑 PASSWORD RESET TOKEN for ${email}: ${resetToken}`);

        res.status(200).json({
            message: "Password reset instructions have been sent to your email."
        });
    } catch (err) {
        console.error("Forgot password error:", err);
        res.status(500).json({ message: "Something went wrong", error: err.message });
    }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ message: "Token and new password are required" });
        }

        const user = await User.findOne({
            where: {
                resetPasswordToken: token,
            },
        });

        if (!user || user.resetPasswordExpires < Date.now()) {
            return res.status(400).json({ message: "Invalid or expired password reset token" });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();

        res.status(200).json({ message: "Password has been successfully reset. You can now login." });
    } catch (err) {
        console.error("Reset password error:", err);
        res.status(500).json({ message: "Could not reset password", error: err.message });
    }
};