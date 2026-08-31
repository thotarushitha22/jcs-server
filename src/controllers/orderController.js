const dbPool = require("../config/db");
const pool = dbPool.pool || dbPool;

// ==========================================
// CREATE ORDER (Includes timestamps for Neon schema)
// ==========================================
const createOrder = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const { items, totalAmount, shippingAddress, shippingName, shippingPhone, shippingCity, shippingPincode, shippingGstin, paymentMethod } = req.body;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized: Missing user ID" });
        }

        if (!items || items.length === 0) {
            return res.status(400).json({ message: "No items provided in order" });
        }

        const result = await pool.query(
            `INSERT INTO orders ("buyerId", "totalAmount", "shippingAddress", "shippingName", "shippingPhone", "shippingCity", "shippingPincode", "shippingGstin", "paymentMethod", status, "createdAt", "updatedAt") 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) RETURNING *;`,
            [
                userId,
                totalAmount,
                shippingAddress,
                shippingName || "",
                shippingPhone || "",
                shippingCity || "",
                shippingPincode || "",
                shippingGstin || null,
                paymentMethod || "COD",
                "Pending"
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Order created successfully",
            order: result.rows[0]
        });
    } catch (error) {
        console.error("Error creating order:", error.message);
        return res.status(500).json({ message: "Server error creating order" });
    }
};

// ==========================================
// CUSTOMER: GET MY ORDERS (Isolated)
// ==========================================
const getMyOrders = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || req.user?._id;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized: Missing user identification" });
        }

        const result = await pool.query(
            'SELECT * FROM orders WHERE "buyerId" = $1 ORDER BY id DESC',
            [userId]
        );

        return res.status(200).json(result.rows || []);
    } catch (error) {
        console.error("Error fetching customer orders:", error.message);
        return res.status(500).json({ message: "Server error fetching your orders" });
    }
};

// ==========================================
// ADMIN: GET ALL ORDERS
// ==========================================
const getAllOrders = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT o.*, u.name as buyer_name, u.email as buyer_email 
            FROM orders o 
            LEFT JOIN users u ON o."buyerId" = u.id 
            ORDER BY o.id DESC
        `);
        return res.status(200).json(result.rows || []);
    } catch (error) {
        console.error("Error fetching admin orders:", error.message);
        return res.status(500).json({ message: "Server error fetching admin orders" });
    }
};

// ==========================================
// GET ORDER BY ID
// ==========================================
const getOrderById = async (req, res) => {
    try {
        const orderIdentifier = req.params.id;
        const numericId = orderIdentifier.replace(/\D/g, "");

        if (!numericId) {
            return res.status(404).json({ message: "Order not found in database (invalid numeric format)" });
        }

        const result = await pool.query('SELECT * FROM orders WHERE id = $1', [numericId]);

        if (!result || result.rows.length === 0) {
            return res.status(404).json({ message: "Order not found in database" });
        }

        return res.status(200).json({ order: result.rows[0] });
    } catch (error) {
        console.error("Fetch order by ID error:", error.message);
        return res.status(500).json({ message: "Server error fetching order" });
    }
};

// ==========================================
// UPDATE ORDER STATUS
// ==========================================
const updateOrderStatus = async (req, res) => {
    try {
        const orderIdentifier = req.params.id;
        const numericId = orderIdentifier.replace(/\D/g, "");
        const { status } = req.body;

        if (!numericId) {
            return res.status(404).json({ message: "Order not found in database for update" });
        }

        const result = await pool.query(
            'UPDATE orders SET status = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *;',
            [status, numericId]
        );

        if (!result || result.rows.length === 0) {
            return res.status(404).json({ message: "Order not found in database to update" });
        }

        return res.status(200).json({
            success: true,
            message: "Order status updated successfully",
            order: result.rows[0]
        });
    } catch (error) {
        console.error("Error updating order status:", error.message);
        return res.status(500).json({ message: "Server error updating order status" });
    }
};

module.exports = {
    createOrder,
    getMyOrders,
    getAllOrders,
    getOrderById,
    updateOrderStatus
};