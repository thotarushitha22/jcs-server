const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");
const Product = require("./Product");

const Order = sequelize.define("Order", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    totalAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    gstAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    status: {
        type: DataTypes.ENUM("placed", "shipped", "delivered", "cancelled"),
        defaultValue: "placed",
    },
    paymentStatus: {
        type: DataTypes.ENUM("pending", "paid"),
        defaultValue: "pending",
    },
    paymentMethod: {
        type: DataTypes.ENUM("upi", "credit", "cod"),
        defaultValue: "upi",
    },
    shippingName: DataTypes.STRING,
    shippingGstin: DataTypes.STRING,
    shippingAddress: DataTypes.STRING,
    shippingCity: DataTypes.STRING,
    shippingPincode: DataTypes.STRING,
    shippingPhone: DataTypes.STRING,
}, {
    tableName: "orders",
    timestamps: true,
});

// Line items — one row per product in an order, with qty/price captured
// at the time of purchase (so later price changes don't rewrite history).
const OrderItem = sequelize.define("OrderItem", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    qty: { type: DataTypes.INTEGER, allowNull: false },
    priceAtPurchase: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
}, {
    tableName: "order_items",
    timestamps: false,
});

Order.belongsTo(User, { foreignKey: "buyerId", as: "buyer" });
User.hasMany(Order, { foreignKey: "buyerId" });

Order.hasMany(OrderItem, { foreignKey: "orderId", as: "items" });
OrderItem.belongsTo(Order, { foreignKey: "orderId" });
OrderItem.belongsTo(Product, { foreignKey: "productId", as: "product" });

module.exports = { Order, OrderItem };