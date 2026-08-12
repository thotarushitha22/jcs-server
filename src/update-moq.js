// Run with: node src/update-moq.js
// Sets every existing product's MOQ to 1.
require("dotenv").config();
const { connectDB } = require("./config/db");
const Product = require("./models/Product");

const run = async () => {
    await connectDB();
    const [count] = await Product.update({ moq: 1 }, { where: {} });
    console.log(`Updated MOQ to 1 for ${count} products.`);
    process.exit(0);
};

run().catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
});