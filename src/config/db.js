require("dotenv").config();
const { Sequelize } = require("sequelize");
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}?sslmode=require`;

// Initialize Sequelize instance
const sequelize = new Sequelize(connectionString, {
    dialect: "postgres",
    dialectOptions: {
        ssl: {
            rejectUnauthorized: false
        }
    },
    logging: false
});

// Initialize raw pool for custom queries
const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

const initializeDatabase = async () => {
    try {
        await pool.query(`
            ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(50) USING role::text;
            ALTER TABLE users ALTER COLUMN role SET DEFAULT 'buyer';

            ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(255);
            ALTER TABLE products ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE products ALTER COLUMN "createdAt" DROP NOT NULL;
            ALTER TABLE products ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE products ALTER COLUMN "updatedAt" DROP NOT NULL;
            ALTER TABLE products ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                business_name VARCHAR(255),
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'buyer',
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS "Orders" (
                id SERIAL PRIMARY KEY,
                "userId" INTEGER NOT NULL,
                "shippingName" VARCHAR(255) NOT NULL,
                "shippingGstin" VARCHAR(255),
                "shippingAddress" TEXT NOT NULL,
                "shippingCity" VARCHAR(255) NOT NULL,
                "shippingPincode" VARCHAR(50) NOT NULL,
                "shippingPhone" VARCHAR(50) NOT NULL,
                "paymentMethod" VARCHAR(50) NOT NULL DEFAULT 'COD',
                "itemsPrice" DECIMAL(10, 2) NOT NULL DEFAULT 0,
                "taxPrice" DECIMAL(10, 2) NOT NULL DEFAULT 0,
                "shippingPrice" DECIMAL(10, 2) NOT NULL DEFAULT 0,
                "totalPrice" DECIMAL(10, 2) NOT NULL DEFAULT 0,
                status VARCHAR(50) NOT NULL DEFAULT 'Pending',
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS "OrderItems" (
                id SERIAL PRIMARY KEY,
                "orderId" INTEGER NOT NULL,
                "productId" INTEGER NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1,
                price DECIMAL(10, 2) NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Database schema verified: constraints, roles, and tables resolved.");
    } catch (err) {
        console.error("Could not auto-update schema:", err.message);
    }
};

pool.on("connect", () => {
    console.log("PostgreSQL connected successfully to Neon!");
});

initializeDatabase();

// CRITICAL: Exporting both sequelize and pool correctly
module.exports = { sequelize, pool };