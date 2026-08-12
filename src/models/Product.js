const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Category = require("./Category");
const User = require("./User");

const Product = sequelize.define("Product", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    title: { type: DataTypes.STRING, allowNull: false },
    brand: DataTypes.STRING,
    sku: { type: DataTypes.STRING, unique: true },
    model: DataTypes.STRING,
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    mrp: DataTypes.DECIMAL(10, 2),
    stock: { type: DataTypes.INTEGER, defaultValue: 0 },
    moq: { type: DataTypes.INTEGER, defaultValue: 1 },
    gstPercent: { type: DataTypes.INTEGER, defaultValue: 18 },
    verified: { type: DataTypes.BOOLEAN, defaultValue: false },
    overview: DataTypes.TEXT,
    warranty: DataTypes.TEXT,
    // JSONB lets us store arrays/objects directly — image lists, variant option sets —
    // without needing separate join tables for a project this size.
    images: { type: DataTypes.JSONB, defaultValue: [] },
    variants: { type: DataTypes.JSONB, defaultValue: null },
}, {
    tableName: "products",
    timestamps: true,
});

// A product belongs to one category; a category can have many products.
Product.belongsTo(Category, { foreignKey: "categoryId", as: "category" });
Category.hasMany(Product, { foreignKey: "categoryId" });

// Track which seller/admin created the listing.
Product.belongsTo(User, { foreignKey: "createdBy", as: "creator" });

module.exports = Product;