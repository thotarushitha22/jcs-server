const { sequelize } = require("../config/db");
const { QueryTypes } = require("sequelize");

const getCategories = async (req, res) => {
    try {
        const categories = await sequelize.query(
            "SELECT * FROM categories ORDER BY id ASC",
            { type: QueryTypes.SELECT }
        );
        res.json(categories);
    } catch (error) {
        console.error("Get Categories Error:", error);
        res.status(500).json({ message: "Failed to fetch categories", error: error.message });
    }
};

module.exports = { getCategories };