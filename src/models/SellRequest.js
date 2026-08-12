const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

const SellRequest = sequelize.define("SellRequest", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    productName: { type: DataTypes.STRING, allowNull: false },
    category: DataTypes.STRING,
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    expectedPrice: DataTypes.DECIMAL(10, 2),
    images: { type: DataTypes.JSONB, defaultValue: [] },
    kycDocument: DataTypes.STRING, // uploaded file URL
    status: {
        type: DataTypes.ENUM("submitted", "reviewing", "approved", "rejected"),
        defaultValue: "submitted",
    },
}, {
    tableName: "sell_requests",
    timestamps: true,
});

SellRequest.belongsTo(User, { foreignKey: "sellerId", as: "seller" });
User.hasMany(SellRequest, { foreignKey: "sellerId" });

module.exports = SellRequest;