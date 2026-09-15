const express = require("express");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const router = express.Router();

console.log("========================================");
console.log("🔥 PAYMENT ROUTES FILE LOADED");
console.log("========================================");

// ===============================
// RAZORPAY ENVIRONMENT CHECK
// ===============================

if (process.env.RAZORPAY_KEY_ID) {
    console.log("✅ RAZORPAY_KEY_ID found");
} else {
    console.log("❌ RAZORPAY_KEY_ID missing");
}

if (process.env.RAZORPAY_KEY_SECRET) {
    console.log("✅ RAZORPAY_KEY_SECRET found");
} else {
    console.log("❌ RAZORPAY_KEY_SECRET missing");
}

// ===============================
// RAZORPAY CLIENT
// ===============================

let razorpay = null;

if (
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET
) {
    razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    console.log("✅ Razorpay client initialized");
} else {
    console.log(
        "⚠️ Razorpay client was NOT initialized because keys are missing"
    );
}

// ======================================================
// PAYMENT HEALTH CHECK
// GET /api/payment
// ======================================================

router.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "JCS Razorpay Payment API is working",
        razorpayConfigured: razorpay !== null,
        mode:
            process.env.RAZORPAY_KEY_ID &&
            process.env.RAZORPAY_KEY_ID.startsWith("rzp_test_")
                ? "TEST"
                : "UNKNOWN",
    });
});

// ======================================================
// CREATE RAZORPAY ORDER
//
// POST /api/payment/create-order
//
// Body:
//
// {
//     "amount": 100,
//     "currency": "INR",
//     "receipt": "JCS-TEST-001"
// }
//
// Amount is in RUPEES.
// Razorpay receives amount in PAISE.
// ======================================================

router.post("/create-order", async (req, res) => {
    console.log("========================================");
    console.log("🔥 CREATE ORDER ROUTE HIT");
    console.log("Request body:", req.body);
    console.log("========================================");

    try {
        // ---------------------------------------
        // Check Razorpay
        // ---------------------------------------

        if (!razorpay) {
            return res.status(500).json({
                success: false,
                message:
                    "Razorpay is not configured. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env",
            });
        }

        // ---------------------------------------
        // Get request data
        // ---------------------------------------

        const {
            amount,
            currency = "INR",
            receipt,
        } = req.body;

        // ---------------------------------------
        // Validate amount
        // ---------------------------------------

        const numericAmount = Number(amount);

        if (
            amount === undefined ||
            amount === null ||
            Number.isNaN(numericAmount) ||
            numericAmount <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid payment amount is required",
            });
        }

        // ---------------------------------------
        // Convert rupees to paise
        // ---------------------------------------

        const amountInPaise = Math.round(
            numericAmount * 100
        );

        // ---------------------------------------
        // Create receipt
        // ---------------------------------------

        const finalReceipt =
            receipt || `JCS_${Date.now()}`;

        const safeReceipt = String(
            finalReceipt
        ).substring(0, 40);

        // ---------------------------------------
        // Razorpay order options
        // ---------------------------------------

        const options = {
            amount: amountInPaise,
            currency: currency || "INR",
            receipt: safeReceipt,
        };

        console.log(
            "Creating Razorpay order:",
            options
        );

        // ---------------------------------------
        // Create Razorpay order
        // ---------------------------------------

        const order =
            await razorpay.orders.create(options);

        console.log(
            "✅ Razorpay order created:",
            order.id
        );

        // ---------------------------------------
        // Response
        // ---------------------------------------

        return res.status(200).json({
            success: true,

            order: {
                id: order.id,
                entity: order.entity,
                amount: order.amount,
                amount_paid: order.amount_paid,
                amount_due: order.amount_due,
                currency: order.currency,
                receipt: order.receipt,
                status: order.status,
            },

            // Public test key.
            // NEVER send the secret key.
            keyId: process.env.RAZORPAY_KEY_ID,
        });
    } catch (error) {
        console.error(
            "❌ Razorpay create order error:"
        );

        console.error(error);

        return res.status(500).json({
            success: false,
            message:
                error?.error?.description ||
                error?.error?.reason ||
                error?.message ||
                "Unable to create Razorpay order",

            razorpayError: {
                code: error?.error?.code || null,
                reason: error?.error?.reason || null,
            },
        });
    }
});

// ======================================================
// VERIFY RAZORPAY PAYMENT
//
// POST /api/payment/verify
// ======================================================

router.post("/verify", async (req, res) => {
    console.log("========================================");
    console.log("🔥 PAYMENT VERIFY ROUTE HIT");
    console.log("========================================");

    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        } = req.body;

        // ---------------------------------------
        // Validate fields
        // ---------------------------------------

        if (
            !razorpay_order_id ||
            !razorpay_payment_id ||
            !razorpay_signature
        ) {
            return res.status(400).json({
                success: false,
                verified: false,
                message:
                    "Missing Razorpay payment details",
            });
        }

        // ---------------------------------------
        // Check secret
        // ---------------------------------------

        if (!process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({
                success: false,
                verified: false,
                message:
                    "Razorpay secret key is missing",
            });
        }

        // ---------------------------------------
        // Generate signature
        // ---------------------------------------

        const generatedSignature = crypto
            .createHmac(
                "sha256",
                process.env.RAZORPAY_KEY_SECRET
            )
            .update(
                `${razorpay_order_id}|${razorpay_payment_id}`
            )
            .digest("hex");

        // ---------------------------------------
        // Compare signatures
        // ---------------------------------------

        if (
            generatedSignature !==
            razorpay_signature
        ) {
            console.error(
                "❌ Invalid Razorpay signature"
            );

            return res.status(400).json({
                success: false,
                verified: false,
                message:
                    "Invalid Razorpay payment signature",
            });
        }

        // ---------------------------------------
        // Success
        // ---------------------------------------

        console.log(
            "✅ Razorpay payment verified successfully"
        );

        return res.status(200).json({
            success: true,
            verified: true,
            message:
                "Razorpay payment verified successfully",

            razorpay_order_id,
            razorpay_payment_id,
        });
    } catch (error) {
        console.error(
            "❌ Razorpay verification error:",
            error
        );

        return res.status(500).json({
            success: false,
            verified: false,
            message:
                "Payment verification failed",
        });
    }
});

// ======================================================
// EXPORT ROUTER
// ======================================================

module.exports = router;