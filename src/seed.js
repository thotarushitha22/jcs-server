// Run with: node src/seed.js
// Populates categories + products so the API returns real data matching
// what the frontend's mockProducts.js currently fakes.
require("dotenv").config();
const { connectDB, sequelize } = require("./config/db");
const Category = require("./models/Category");
const Product = require("./models/Product");

const categories = [
    { name: "Smartphones", slug: "smartphones" },
    { name: "Tablets", slug: "tablets" },
    { name: "TVs", slug: "tvs" },
    { name: "Accessories", slug: "accessories" },
];

const deviceVariants = {
    storage: ["4/128 GB", "8/128 GB", "8/256 GB"],
    colors: ["Midnight Black", "Ocean Blue", "Pearl White"],
    boxType: ["Sealed", "Loose"],
    activation: ["Fresh", "Activated"],
};

const products = [
    {
        title: "Galaxy A55 5G — 128GB", brand: "Samsung", slug: "smartphones",
        price: 21999, mrp: 25999, stock: 340, moq: 10, verified: true,
        sku: "JCS-P1-SMA55", model: "SM-A556E", gstPercent: 18,
        warranty: "1 year manufacturer warranty on the device, 6 months on included accessories.",
        overview: "Genuine Samsung Galaxy A55 5G units, brand-sealed and GST-invoiced.",
        variants: deviceVariants,
        images: ["https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600&q=80"],
    },
    {
        title: "Redmi Pad Pro 12.1\"", brand: "Xiaomi", slug: "tablets",
        price: 15499, mrp: 18999, stock: 120, moq: 5, verified: true,
        sku: "JCS-P2-RPADPRO", model: "23090RA98I", gstPercent: 18,
        warranty: "1 year manufacturer warranty on the device, 6 months on included accessories.",
        overview: "Redmi Pad Pro units in sealed retail boxes, GST-invoiced per lot.",
        variants: deviceVariants,
        images: ["https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&q=80"],
    },
    {
        title: "Crystal UHD 55\" Smart TV", brand: "Samsung", slug: "tvs",
        price: 38999, mrp: 46999, stock: 54, moq: 2, verified: true,
        sku: "JCS-P3-CUHD55", model: "UA55CU7700", gstPercent: 18,
        warranty: "1 year manufacturer warranty on panel and electronics.",
        overview: "Factory-sealed Crystal UHD 55-inch panels. Palletized shipping available.",
        variants: null,
        images: ["https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&q=80"],
    },
    {
        title: "iPhone 14 — 128GB (Refurb Grade A)", brand: "Apple", slug: "smartphones",
        price: 46999, mrp: 54999, stock: 72, moq: 5, verified: true,
        sku: "JCS-P4-IP14RA", model: "A2882", gstPercent: 18,
        warranty: "6 months JCSGlobal refurbishment warranty covering battery and screen defects.",
        overview: "Grade A refurbished iPhone 14 units — battery health 85%+, factory reset.",
        variants: deviceVariants,
        images: ["https://images.unsplash.com/photo-1678652197831-2d180705cd2c?w=600&q=80"],
    },
    {
        title: "65W GaN Fast Charger — Bulk Pack", brand: "Anker", slug: "accessories",
        price: 899, mrp: 1299, stock: 1840, moq: 50, verified: true,
        sku: "JCS-P5-ANK65W", model: "A2149", gstPercent: 18,
        warranty: "18-month manufacturer warranty per unit.",
        overview: "Bulk-packed 65W GaN chargers, individually boxed with cable included.",
        variants: null,
        images: ["https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&q=80"],
    },
    {
        title: "Tab S9 FE 10.9\" 128GB", brand: "Samsung", slug: "tablets",
        price: 27999, mrp: 32999, stock: 88, moq: 5, verified: false,
        sku: "JCS-P6-TABS9FE", model: "SM-X510", gstPercent: 18,
        warranty: "1 year manufacturer warranty on the device, 6 months on included accessories.",
        overview: "Tab S9 FE units — supplier KYC verification in progress.",
        variants: deviceVariants,
        images: ["https://images.unsplash.com/photo-1561154464-82e9adf32764?w=600&q=80"],
    },
    {
        title: "OLED 48\" Gaming TV", brand: "LG", slug: "tvs",
        price: 79999, mrp: 94999, stock: 21, moq: 1, verified: true,
        sku: "JCS-P7-OLED48", model: "OLED48C3", gstPercent: 18,
        warranty: "1 year manufacturer warranty, panel burn-in coverage per LG policy.",
        overview: "LG OLED 48-inch gaming panels, 120Hz native refresh.",
        variants: null,
        images: ["https://images.unsplash.com/photo-1601944177325-f8867652837f?w=600&q=80"],
    },
    {
        title: "Tempered Glass Screen Guard — Universal", brand: "JCS Essentials", slug: "accessories",
        price: 29, mrp: 49, stock: 9600, moq: 200, verified: true,
        sku: "JCS-P8-TGUNIV", model: "TG-UNI-001", gstPercent: 18,
        warranty: "No warranty — consumable accessory item.",
        overview: "Universal tempered glass guards, bulk-boxed in sets of 200.",
        variants: null,
        images: ["https://images.unsplash.com/photo-1601972602288-3be527b4f18a?w=600&q=80"],
    },
];

const run = async () => {
    await connectDB();
    await sequelize.sync({ alter: true });

    for (const cat of categories) {
        await Category.findOrCreate({ where: { slug: cat.slug }, defaults: cat });
    }
    console.log("Categories seeded.");

    for (const p of products) {
        const category = await Category.findOne({ where: { slug: p.slug } });
        const { slug, ...productData } = p;
        await Product.findOrCreate({
            where: { sku: p.sku },
            defaults: { ...productData, categoryId: category.id },
        });
    }
    console.log("Products seeded.");

    process.exit(0);
};

run().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});