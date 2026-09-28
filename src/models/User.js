const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const User = sequelize.define("User", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    phone: DataTypes.STRING,
    role: {
        type: DataTypes.ENUM("buyer", "seller", "admin"),
        defaultValue: "buyer",
    },
    gstNumber: DataTypes.STRING,
    kycStatus: {
        type: DataTypes.ENUM("pending", "verified", "rejected"),
        defaultValue: "pending",
    },
    resetPasswordToken: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    resetPasswordExpires: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName: "users",
    timestamps: true,
});

module.exports = User;