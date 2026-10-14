const express = require("express");
const router = express.Router();

/* =========================================
   DB POOL (matches src/config/db.js exports)
   Your config/db.js exports: { sequelize, pool }
   ========================================= */
const { pool: db } = require("../config/db");

/* =========================================
   CONFIG
   ========================================= */
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// .trim() protects against stray whitespace/newlines in env var
const MODEL = (process.env.GROQ_MODEL || "openai/gpt-oss-120b").trim();

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY = 12;
const MAX_REPLY_TOKENS = 600;
const REQUEST_TIMEOUT_MS = 25000;

const WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 20;

/* =========================================
   SYSTEM PROMPT
   ========================================= */
const SYSTEM_PROMPT = `You are the JCS Global Assistant, the chat helper on the JCS Global website.

About JCS Global:
- JCS Global is a B2B online marketplace based in Vijayawada, Andhra Pradesh, India. Verified suppliers and merchants list electronics and other products, and businesses buy from them.
- Prices are in Indian rupees (INR). GST (18%) is added at checkout and shown on the tax invoice.
- Some products have a minimum order quantity (MOQ) for bulk orders.
- Payment options at checkout: Razorpay (UPI, cards, netbanking), Cash on Delivery, and Credit terms for approved accounts.
- Customers can follow an order on the "Your orders" page. Tracking shows 10 stops from "Order placed" to "Delivered".
- Merchants add and manage their products and orders from the Merchant Dashboard.
- Support: tech.support@jcsglobal.in or +91-9090007108.

How to answer:
- If live product data is provided below (under "Live product data from JCS Global"), use the EXACT price, MOQ, stock and GST from it. Do not invent or modify those values.
- If the user asks about a product and NO live data is provided for it, say you don't have exact info and direct them to the product page or support.
- Never invent delivery dates or the status of a specific order. For those, direct to "Your orders" or support.
- If you are unsure about a JCS Global policy, say so and suggest contacting support.
- Reply in the same language the customer writes in.
- Keep answers short, clear and professional.
- Use plain text only. No markdown symbols such as ** or #. For lists, use a hyphen at the start of each line.`;

/* =========================================
   RATE LIMITING
   ========================================= */
const hits = new Map();

function isRateLimited(ip) {
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((time) => now - time < WINDOW_MS);

    recent.push(now);
    hits.set(ip, recent);

    return recent.length > MAX_REQUESTS_PER_WINDOW;
}

setInterval(() => {
    const now = Date.now();

    for (const [ip, times] of hits) {
        const recent = times.filter((time) => now - time < WINDOW_MS);

        if (recent.length > 0) {
            hits.set(ip, recent);
        } else {
            hits.delete(ip);
        }
    }
}, WINDOW_MS).unref();

function getClientIp(req) {
    const forwarded = String(req.headers["x-forwarded-for"] || "")
        .split(",")[0]
        .trim();

    return forwarded || req.ip || "unknown";
}

/* =========================================
   BUILD MESSAGES
   ========================================= */
function buildMessages(history, message) {
    const cleaned = [];
    const list = Array.isArray(history) ? history.slice(-MAX_HISTORY) : [];

    for (const item of list) {
        const role =
            item?.role === "assistant"
                ? "assistant"
                : item?.role === "user"
                    ? "user"
                    : null;

        const content =
            typeof item?.content === "string"
                ? item.content.trim().slice(0, MAX_MESSAGE_LENGTH)
                : "";

        if (role && content) {
            cleaned.push({ role, content });
        }
    }

    const last = cleaned[cleaned.length - 1];

    if (!last || last.role !== "user" || last.content !== message) {
        cleaned.push({ role: "user", content: message });
    }

    return cleaned;
}

/* =========================================
   PRODUCT LOOKUP — Neon Postgres
   ========================================= */

function extractKeywords(message) {
    return message
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .slice(0, 6);
}

/**
 * Query the products table using real column names:
 *   title, brand, model, price, mrp, stock, moq, gstPercent, description
 */
async function findRelevantProducts(message) {
    const keywords = extractKeywords(message);
    if (keywords.length === 0) return [];

    try {
        // LOWER(title) LIKE $1 OR LOWER(brand) LIKE $1 OR LOWER(model) LIKE $1 ...
        const conditions = keywords
            .flatMap((_, i) => [
                `LOWER(title) LIKE $${i + 1}`,
                `LOWER(brand) LIKE $${i + 1}`,
                `LOWER(COALESCE(model, '')) LIKE $${i + 1}`,
            ])
            .join(" OR ");

        const params = keywords.map((k) => `%${k}%`);

        const sql = `
            SELECT
                id,
                title,
                brand,
                model,
                price,
                mrp,
                stock,
                moq,
                "gstPercent" AS gst,
                description
            FROM products
            WHERE ${conditions}
            ORDER BY id DESC
            LIMIT 5;
        `;

        const result = await db.query(sql, params);
        return result.rows || [];
    } catch (err) {
        console.error("CHAT: product lookup failed:", err.message);
        return [];
    }
}

function buildProductContext(products) {
    if (!products || products.length === 0) return "";

    const block = products
        .map((p, i) => {
            const lines = [];

            lines.push(
                `${i + 1}. ${p.title}${p.brand ? ` — Brand: ${p.brand}` : ""}${
                    p.model ? ` — Model: ${p.model}` : ""
                }`
            );

            if (p.price != null) lines.push(`   Price: Rs. ${p.price}`);
            if (p.mrp != null && p.mrp !== p.price) lines.push(`   MRP: Rs. ${p.mrp}`);
            lines.push(`   MOQ: ${p.moq != null ? p.moq : 1}`);
            lines.push(`   Stock: ${p.stock != null ? p.stock : "In Stock"}`);
            lines.push(`   GST: ${p.gst != null ? p.gst : 18}%`);

            if (p.description) {
                const short = String(p.description).replace(/\s+/g, " ").slice(0, 220);
                lines.push(`   Description: ${short}`);
            }

            return lines.join("\n");
        })
        .join("\n");

    return `\n\nLive product data from JCS Global (use this to answer):\n${block}`;
}

/* =========================================
   ROUTE: POST /api/chat
   ========================================= */
router.post("/", async (req, res) => {
    try {
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey) {
            console.error("CHAT: GROQ_API_KEY is not set on the server.");
            return res.status(503).json({
                success: false,
                message: "The AI assistant is not set up yet.",
            });
        }

        if (isRateLimited(getClientIp(req))) {
            return res.status(429).json({
                success: false,
                message: "Too many requests. Please wait a moment and try again.",
            });
        }

        const message =
            typeof req.body?.message === "string" ? req.body.message.trim() : "";

        if (!message) {
            return res.status(400).json({
                success: false,
                message: "Please type a question.",
            });
        }

        const formattedHistory = buildMessages(req.body?.history, message);

        // 🔎 Live product lookup
        const matchedProducts = await findRelevantProducts(message);
        const productContext = buildProductContext(matchedProducts);

        if (matchedProducts.length > 0) {
            console.log(
                `CHAT: matched ${matchedProducts.length} product(s) for "${message}"`
            );
        }

        const messages = [
            { role: "system", content: SYSTEM_PROMPT + productContext },
            ...formattedHistory,
        ];

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        let upstream;

        try {
            upstream = await fetch(GROQ_URL, {
                method: "POST",
                signal: controller.signal,
                headers: {
                    "content-type": "application/json",
                    authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: MODEL,
                    max_tokens: MAX_REPLY_TOKENS,
                    messages,
                }),
            });
        } finally {
            clearTimeout(timer);
        }

        if (!upstream.ok) {
            const details = await upstream.text().catch(() => "");
            console.error(
                "CHAT: AI service error",
                upstream.status,
                details.slice(0, 500)
            );

            return res.status(503).json({
                success: false,
                message: "The AI assistant is temporarily unavailable.",
            });
        }

        const data = await upstream.json();
        const reply = data?.choices?.[0]?.message?.content?.trim() || "";

        if (!reply) {
            return res.status(502).json({
                success: false,
                message: "The assistant returned an empty answer.",
            });
        }

        return res.json({ success: true, reply });
    } catch (err) {
        console.error("CHAT: error", err.message);

        return res.status(503).json({
            success: false,
            message:
                err.name === "AbortError"
                    ? "The assistant took too long to answer. Please try again."
                    : "The AI assistant is temporarily unavailable.",
        });
    }
});

module.exports = router;