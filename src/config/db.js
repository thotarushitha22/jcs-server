const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: "postgres",
        logging: false,
    }
);

const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log(`PostgreSQL connected: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
    } catch (err) {
        console.error(`PostgreSQL connection failed: ${err.message}`);
        process.exit(1);
    }
};

module.exports = { sequelize, connectDB };