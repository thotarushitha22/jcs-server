const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");
const Product = require("./Product");

const Order = sequelize.define("Order", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    totalAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    gstAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    status: { type: DataTypes.STRING(30), defaultValue: "PENDING" },
    paymentStatus: { type: DataTypes.ENUM("pending", "paid"), defaultValue: "pending" },
    paymentMethod: { type: DataTypes.ENUM("upi", "credit", "cod"), defaultValue: "upi" },
    shippingName: DataTypes.STRING,
    shippingGstin: DataTypes.STRING,
    shippingAddress: DataTypes.STRING,
    shippingCity: DataTypes.STRING,
    shippingPincode: DataTypes.STRING,
    shippingPhone: DataTypes.STRING,

    // Feedback & Cancellation columns
    cancelReason: { type: DataTypes.STRING, allowNull: true },
    deliveryRating: { type: DataTypes.INTEGER, allowNull: true },
    deliveryFeedback: { type: DataTypes.TEXT, allowNull: true },
}, {
    tableName: "orders",
    timestamps: true,
});

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