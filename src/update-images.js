// Run with: node src/update-images.js
// Adds a bigger gallery of images to every seeded product across all categories.
require("dotenv").config();
const { connectDB } = require("./config/db");
const Product = require("./models/Product");

const imagesBySku = {
    "JCS-P1-SMA55": [
        "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600&q=80",
        "https://images.unsplash.com/photo-1610945415245-d3a5b9a6f5d8?w=600&q=80",
        "https://images.unsplash.com/photo-1592286927505-1def25115481?w=600&q=80",
        "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&q=80",
        "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&q=80",
        "https://images.unsplash.com/photo-1580910051074-3eb694886505?w=600&q=80",
    ],
    "JCS-P2-RPADPRO": [
        "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&q=80",
        "https://images.unsplash.com/photo-1561154464-82e9adf32764?w=600&q=80",
        "https://images.unsplash.com/photo-1585790050230-5dd28404ccb9?w=600&q=80",
        "https://images.unsplash.com/photo-1544244015-9d3e9d5c04a5?w=600&q=80",
        "https://images.unsplash.com/photo-1623126908029-58c1a7c8f8d0?w=600&q=80",
    ],
    "JCS-P3-CUHD55": [
        "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&q=80",
        "https://images.unsplash.com/photo-1601944177325-f8867652837f?w=600&q=80",
        "https://images.unsplash.com/photo-1552975084-6e027cd345c2?w=600&q=80",
        "https://images.unsplash.com/photo-1601944179066-29786cb9d32a?w=600&q=80",
        "https://images.unsplash.com/photo-1567690187548-f07b1d7bf5a9?w=600&q=80",
    ],
    "JCS-P4-IP14RA": [
        "https://images.unsplash.com/photo-1678652197831-2d180705cd2c?w=600&q=80",
        "https://images.unsplash.com/photo-1592286927505-1def25115481?w=600&q=80",
        "https://images.unsplash.com/photo-1610945415245-d3a5b9a6f5d8?w=600&q=80",
        "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&q=80",
        "https://images.unsplash.com/photo-1611791484670-ce19b801d192?w=600&q=80",
        "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600&q=80",
    ],
    "JCS-P5-ANK65W": [
        "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&q=80",
        "https://images.unsplash.com/photo-1601972602288-3be527b4f18a?w=600&q=80",
        "https://images.unsplash.com/photo-1583863788668-ab13606c5b76?w=600&q=80",
        "https://images.unsplash.com/photo-1622959588934-1d94a1a45b04?w=600&q=80",
    ],
    "JCS-P6-TABS9FE": [
        "https://images.unsplash.com/photo-1561154464-82e9adf32764?w=600&q=80",
        "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&q=80",
        "https://images.unsplash.com/photo-1585790050230-5dd28404ccb9?w=600&q=80",
        "https://images.unsplash.com/photo-1623126908029-58c1a7c8f8d0?w=600&q=80",
    ],
    "JCS-P7-OLED48": [
        "https://images.unsplash.com/photo-1601944177325-f8867652837f?w=600&q=80",
        "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&q=80",
        "https://images.unsplash.com/photo-1552975084-6e027cd345c2?w=600&q=80",
        "https://images.unsplash.com/photo-1567690187548-f07b1d7bf5a9?w=600&q=80",
    ],
    "JCS-P8-TGUNIV": [
        "https://images.unsplash.com/photo-1601972602288-3be527b4f18a?w=600&q=80",
        "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&q=80",
        "https://images.unsplash.com/photo-1622959588934-1d94a1a45b04?w=600&q=80",
    ],
};

const run = async () => {
    await connectDB();

    for (const [sku, images] of Object.entries(imagesBySku)) {
        const product = await Product.findOne({ where: { sku } });
        if (product) {
            product.images = images;
            await product.save();
            console.log(`Updated images for ${sku} (${images.length} photos)`);
        } else {
            console.log(`No product found for ${sku} — skipped`);
        }
    }

    console.log("Done.");
    process.exit(0);
};

run().catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
});