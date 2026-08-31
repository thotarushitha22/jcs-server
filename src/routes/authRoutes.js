const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
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
// REGISTER ROUTE (Added to fix 404 error)
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

module.exports = router;