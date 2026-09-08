const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Category = require("./Category");
const User = require("./User");

const Product = sequelize.define(
    "Product",
    {
        // =================================================
        // BASIC PRODUCT INFORMATION
        // =================================================

        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },

        title: {
            type: DataTypes.STRING,
            allowNull: false
        },

        brand: {
            type: DataTypes.STRING,
            allowNull: true
        },

        sku: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: true
        },

        model: {
            type: DataTypes.STRING,
            allowNull: true
        },

        // =================================================
        // PRICE & STOCK
        // =================================================

        price: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },

        mrp: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },

        stock: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },

        moq: {
            type: DataTypes.INTEGER,
            defaultValue: 1
        },

        gstPercent: {
            type: DataTypes.INTEGER,
            defaultValue: 18
        },

        // =================================================
        // APPROVAL
        // =================================================

        verified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },

        approvalStatus: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: "PENDING"
        },

        approvedBy: {
            type: DataTypes.INTEGER,
            allowNull: true
        },

        approvedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },

        rejectionReason: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        // =================================================
        // DESCRIPTION
        // =================================================

        overview: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        // =================================================
        // PRODUCT HIGHLIGHTS
        // =================================================

        highlights: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: []
        },

        // =================================================
        // PRODUCT SPECIFICATIONS
        // =================================================

        colour: {
            type: DataTypes.STRING,
            allowNull: true
        },

        storage: {
            type: DataTypes.STRING,
            allowNull: true
        },

        ram: {
            type: DataTypes.STRING,
            allowNull: true
        },

        networkGen: {
            type: DataTypes.STRING,
            allowNull: true
        },

        simSlots: {
            type: DataTypes.STRING,
            allowNull: true
        },

        screenSize: {
            type: DataTypes.STRING,
            allowNull: true
        },

        rearCamera: {
            type: DataTypes.STRING,
            allowNull: true
        },

        frontCamera: {
            type: DataTypes.STRING,
            allowNull: true
        },

        securityFeatures: {
            type: DataTypes.STRING,
            allowNull: true
        },

        weight: {
            type: DataTypes.STRING,
            allowNull: true
        },

        waterResistant: {
            type: DataTypes.STRING,
            allowNull: true
        },

        fastCharging: {
            type: DataTypes.STRING,
            allowNull: true
        },

        // =================================================
        // WARRANTY
        // =================================================

        warranty: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        // =================================================
        // PRODUCT IMAGES
        // =================================================

        images: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: []
        },

        // =================================================
        // VARIANTS
        // =================================================

        variants: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: null
        },

        // =================================================
        // CATEGORY
        // =================================================

        categoryId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },

        // =================================================
        // MERCHANT
        // =================================================

        merchantId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },

        createdBy: {
            type: DataTypes.INTEGER,
            allowNull: true
        }
    },

    {
        tableName: "products",
        timestamps: true
    }
);

// =====================================================
// RELATIONSHIPS
// =====================================================

Product.belongsTo(Category, {
    foreignKey: "categoryId",
    as: "category"
});

Category.hasMany(Product, {
    foreignKey: "categoryId"
});

Product.belongsTo(User, {
    foreignKey: "createdBy",
    as: "creator"
});

module.exports = Product;