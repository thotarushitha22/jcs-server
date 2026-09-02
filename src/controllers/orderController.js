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
// CUSTOMER & MERCHANT: GET ORDERS (Role-Aware)
// ==========================================
const getMyOrders = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || req.user?._id;
        const userRole = req.user?.role;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized: Missing user identification" });
        }

        let result;

        // If the user is a merchant, seller, or admin, return store orders with buyer metadata
        if (userRole === "merchant" || userRole === "seller" || userRole === "admin") {
            result = await pool.query(`
                SELECT o.*, u.name as buyer_name, u.email as buyer_email 
                FROM orders o 
                LEFT JOIN users u ON o."buyerId" = u.id 
                ORDER BY o.id DESC
            `);
        } else {
            // Regular customer: only see their own purchases
            result = await pool.query(
                'SELECT * FROM orders WHERE "buyerId" = $1 ORDER BY id DESC',
                [userId]
            );
        }

        return res.status(200).json(result.rows || []);
    } catch (error) {
        console.error("Error fetching orders:", error.message);
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
// GET ORDER BY ID (Supports text IDs & numeric IDs)
// ==========================================
const getOrderById = async (req, res) => {
    try {
        const orderIdentifier = req.params.id; // e.g. "JCS-12" or "JCS-RAZORPAY_SANDBOX-45178"
        const cleanId = orderIdentifier.replace(/^JCS-/, "").trim();
        const numericId = orderIdentifier.replace(/\D/g, "");

        const result = await pool.query(
            `SELECT * FROM orders 
             WHERE id::text = $1 OR id::text = $2 OR id::text = $3 
                OR order_id = $1 OR order_id = $2 OR order_id = $3
                OR "orderId" = $1 OR "orderId" = $2 OR "orderId" = $3`,
            [orderIdentifier, cleanId, numericId]
        );

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
// UPDATE ORDER STATUS (Supports text IDs & numeric IDs)
// ==========================================
const updateOrderStatus = async (req, res) => {
    try {
        const orderIdentifier = req.params.id;
        const cleanId = orderIdentifier.replace(/^JCS-/, "").trim();
        const numericId = orderIdentifier.replace(/\D/g, "");
        const { status } = req.body;

        const result = await pool.query(
            `UPDATE orders 
             SET status = $1, "updatedAt" = NOW() 
             WHERE id::text = $2 OR id::text = $3 OR id::text = $4 
                OR order_id = $2 OR order_id = $3 OR order_id = $4
                OR "orderId" = $2 OR "orderId" = $3 OR "orderId" = $4
             RETURNING *;`,
            [status, orderIdentifier, cleanId, numericId]
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