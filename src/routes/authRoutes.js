const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const dbPool = require("../config/db");
const pool = dbPool.pool || dbPool;

// ==========================================
// LOGIN ROUTE
// ==========================================
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Please provide both email and password" });
        }

        if (!pool || typeof pool.query !== "function") {
            throw new Error("Database pool is not configured correctly.");
        }

        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email.trim().toLowerCase()]);

        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        const user = result.rows[0];
        const secret = process.env.JWT_SECRET || "fallback_secret_key";
        let isMatch = false;

        if (user.password && (user.password.startsWith("$2a$") || user.password.startsWith("$2b$"))) {
            isMatch = await bcrypt.compare(password, user.password);
        } else {
            isMatch = (password === user.password);
        }

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        const userRole = user.role ? user.role.toLowerCase() : "buyer";

        const token = jwt.sign(
            { id: user.id, email: user.email, role: userRole },
            secret,
            { expiresIn: "30d" }
        );

        return res.status(200).json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: userRole
            }
        });
    } catch (error) {
        console.error("CRITICAL LOGIN ERROR:", error.message);
        return res.status(500).json({ message: "Server error during login", error: error.message });
    }
});

// ==========================================
// REGISTER ROUTE
// ==========================================
router.post("/register", async (req, res) => {
    try {
        const { name, email, password, role, gstNumber } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: "Please provide all required fields." });
        }

        if (!pool || typeof pool.query !== "function") {
            throw new Error("Database pool is not configured correctly.");
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check if account already exists
        const existingUser = await pool.query("SELECT * FROM users WHERE email = $1", [normalizedEmail]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: "An account with this email already exists." });
        }

        // Hash password securely
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Normalize role (mapping 'seller' or 'merchant' appropriately)
        let userRole = "buyer";
        if (role && ["merchant", "seller"].includes(role.toLowerCase())) {
            userRole = "merchant";
        }

        const finalGst = userRole === "merchant" ? (gstNumber ? gstNumber.trim().toUpperCase() : "") : null;

        // Insert new user into PostgreSQL database
        const newUserQuery = `
            INSERT INTO users (name, email, password, role, gst_number) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING id, name, email, role;
        `;

        const newResult = await pool.query(newUserQuery, [
            name.trim(),
            normalizedEmail,
            hashedPassword,
            userRole,
            finalGst
        ]);

        return res.status(201).json({
            success: true,
            message: "Account created successfully!",
            user: newResult.rows[0]
        });

    } catch (error) {
        console.error("CRITICAL REGISTRATION ERROR:", error.message);
        return res.status(500).json({ message: "Server error during registration", error: error.message });
    }
});

// ==========================================
// FORGOT PASSWORD ROUTE
// ==========================================
router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Please provide an email address." });
        }

        if (!pool || typeof pool.query !== "function") {
            throw new Error("Database pool is not configured correctly.");
        }

        const normalizedEmail = email.trim().toLowerCase();
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [normalizedEmail]);

        // For security reasons, don't explicitly reveal whether the email exists or not
        if (result.rows.length === 0) {
            return res.status(200).json({
                success: true,
                message: "If that email is registered, password reset instructions have been sent."
            });
        }

        const user = result.rows[0];
        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // Token valid for 15 minutes

        // Store reset token and expiration time in the database
        // Note: Make sure your `users` table has `reset_password_token` and `reset_password_expires` columns
        await pool.query(
            "UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3",
            [resetToken, resetExpires, user.id]
        );

        // Development helper log: Check your backend server console to grab the token for local testing
        console.log(`🔑 PASSWORD RESET TOKEN for ${normalizedEmail}: ${resetToken}`);

        return res.status(200).json({
            success: true,
            message: "Password reset instructions have been sent to your email."
        });

    } catch (error) {
        console.error("CRITICAL FORGOT PASSWORD ERROR:", error.message);
        return res.status(500).json({ message: "Server error during forgot password process", error: error.message });
    }
});

// ==========================================
// RESET PASSWORD ROUTE
// ==========================================
router.post("/reset-password", async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ message: "Token and new password are required." });
        }

        if (!pool || typeof pool.query !== "function") {
            throw new Error("Database pool is not configured correctly.");
        }

        // Find user by token and verify expiration
        const result = await pool.query(
            "SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > NOW()",
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ message: "Invalid or expired password reset token." });
        }

        const user = result.rows[0];

        // Hash the new password securely
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password and clear out the token fields
        await pool.query(
            "UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2",
            [hashedPassword, user.id]
        );

        return res.status(200).json({
            success: true,
            message: "Password has been successfully reset. You can now log in."
        });

    } catch (error) {
        console.error("CRITICAL RESET PASSWORD ERROR:", error.message);
        return res.status(500).json({ message: "Server error during password reset", error: error.message });
    }
});

module.exports = router;