const pool = require("../config/db");

const getCategories = async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM categories ORDER BY name ASC");
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch categories", error: error.message });
    }
};

module.exports = {
    getCategories,
};