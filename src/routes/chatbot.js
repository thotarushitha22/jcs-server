const express = require("express");

const router = express.Router();

// =====================================================
// SETTINGS
// (the API key is read from the server environment: ANTHROPIC_API_KEY)
// =====================================================

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// fast and low cost - change it with the CHAT_MODEL variable if you want another model
const MODEL = process.env.CHAT_MODEL || "claude-haiku-4-5-20251001";

const MAX_MESSAGE_LENGTH = 2000; // same limit as the chat box on the website
const MAX_HISTORY = 12; // last 12 messages are sent for context
const MAX_REPLY_TOKENS = 600; // keeps answers short and the cost low
const REQUEST_TIMEOUT_MS = 25000;

// one visitor can send at most 20 questions per minute
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

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
- Help with products, B2B buying, MOQ and bulk orders, payments, order tracking, delivery and merchant services. You can also answer general questions on other topics.
- Never invent prices, stock, delivery dates or the status of a specific order. For those, tell the customer to check the product page or "Your orders", or contact support.
- If you are not sure about a JCS Global policy, say so and suggest contacting support.
- Reply in the same language the customer writes in.
- Keep answers short and clear. Use plain text only: no markdown symbols such as ** or #. For lists, use a hyphen at the start of each line.`;

// =====================================================
// SMALL HELPERS
// =====================================================

// simple per-visitor rate limit (kept in memory)
const hits = new Map();

function isRateLimited(ip) {
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((time) => now - time < WINDOW_MS);

    recent.push(now);
    hits.set(ip, recent);

    return recent.length > MAX_REQUESTS_PER_WINDOW;
}

// forget old visitors so the list never grows forever
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

// Turns what the website sends into a clean list the Claude API accepts:
// - only "user" and "assistant" messages with text
// - the newest question is added only if it is not already the last message
// - the chat must start with the user
// - two messages in a row from the same sender are joined into one (identical repeats are dropped)
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

    while (cleaned.length > 0 && cleaned[0].role !== "user") {
        cleaned.shift();
    }

    const merged = [];

    for (const item of cleaned) {
        const previous = merged[merged.length - 1];

        if (previous && previous.role === item.role) {
            // an identical repeat (for example a retry after an error) is ignored
            if (previous.content !== item.content) {
                previous.content += "\n\n" + item.content;
            }
        } else {
            merged.push({ role: item.role, content: item.content });
        }
    }

    return merged;
}

// =====================================================
// POST /api/chat
// body: { message: "text", history: [{ role, content }] }
// answer: { success: true, reply: "text" }
// =====================================================

router.post("/", async (req, res) => {
    try {
        const apiKey = process.env.ANTHROPIC_API_KEY;

        if (!apiKey) {
            console.error("CHAT: ANTHROPIC_API_KEY is not set on the server.");

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

        if (message.length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `Your message is too long (maximum ${MAX_MESSAGE_LENGTH} characters).`,
            });
        }

        const messages = buildMessages(req.body?.history, message);

        // stop waiting if the AI service is too slow
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        let upstream;

        try {
            upstream = await fetch(ANTHROPIC_URL, {
                method: "POST",
                signal: controller.signal,
                headers: {
                    "content-type": "application/json",
                    "x-api-key": apiKey,
                    "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                    model: MODEL,
                    max_tokens: MAX_REPLY_TOKENS,
                    system: SYSTEM_PROMPT,
                    messages,
                }),
            });
        } finally {
            clearTimeout(timer);
        }

        if (!upstream.ok) {
            const details = await upstream.text().catch(() => "");

            // visible in the Render logs (wrong key, no credit, wrong model name ...)
            console.error("CHAT: AI service error", upstream.status, details.slice(0, 500));

            return res.status(upstream.status === 429 ? 429 : 503).json({
                success: false,
                message:
                    upstream.status === 429
                        ? "The assistant is busy right now. Please try again in a moment."
                        : "The AI assistant is temporarily unavailable.",
            });
        }

        const data = await upstream.json();

        const reply = (Array.isArray(data?.content) ? data.content : [])
            .filter((block) => block?.type === "text")
            .map((block) => block.text)
            .join("\n")
            .trim();

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