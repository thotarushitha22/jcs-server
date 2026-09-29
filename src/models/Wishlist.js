const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Wishlist = sequelize.define(
    "Wishlist",
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: "user_id",
        },
        productId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: "product_id",
        },
    },
    {
        tableName: "wishlists",
        timestamps: false, // Disables automatic createdAt/updatedAt lookup entirely
    }
);

module.exports = Wishlist;