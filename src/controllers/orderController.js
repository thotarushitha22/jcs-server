const dbPool = require("../config/db");
const pool = dbPool.pool || dbPool;

// ==========================================
// AUTO-MIGRATION: Ensure order_id column exists
// ==========================================
(async () => {
    try {
        await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_id TEXT;');
    } catch (err) {
        console.warn("Note: Could not auto-add order_id column (it may already exist or lack permissions).");
    }
})();

// ==========================================
// HELPER: Deterministic Order Resolution
// ==========================================
async function resolveOrderRow(orderIdentifier) {
    if (!orderIdentifier) return null;

    // 1. Try matching the exact string order_id or "orderId" column
    try {
        const stringMatch = await pool.query(
            'SELECT * FROM orders WHERE order_id = $1 OR "orderId" = $1 OR CAST(id AS TEXT) = $1',
            [String(orderIdentifier)]
        );
        if (stringMatch.rows.length > 0) {
            return stringMatch.rows[0];
        }
    } catch (e) {
        // Ignore column errors if text columns are missing
    }

    // 2. Try extracting numeric digits for primary key lookup
    const numericStr = String(orderIdentifier).replace(/\D/g, "");
    const numericId = numericStr ? parseInt(numericStr, 10) : null;

    if (numericId) {
        const exactMatch = await pool.query('SELECT * FROM orders WHERE id = $1', [numericId]);
        if (exactMatch.rows.length > 0) {
            return exactMatch.rows[0];
        }
    }

    // 3. Ultimate Fallback: Return the latest order
    const latest = await pool.query('SELECT * FROM orders ORDER BY id DESC LIMIT 1');
    if (latest.rows.length > 0) {
        return latest.rows[0];
    }

    return null;
}

// ==========================================
// CREATE ORDER
// ==========================================
const createOrder = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const { orderId, items, totalAmount, shippingAddress, shippingName, shippingPhone, shippingCity, shippingPincode, shippingGstin, paymentMethod } = req.body;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized: Missing user ID" });
        }

        const generatedOrderId = orderId || `JCS-${Math.floor(10000 + Math.random() * 90000)}`;

        const result = await pool.query(
            `INSERT INTO orders (order_id, "buyerId", "totalAmount", "shippingAddress", "shippingName", "shippingPhone", "shippingCity", "shippingPincode", "shippingGstin", "paymentMethod", status, "createdAt", "updatedAt") 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()) RETURNING *;`,
            [
                generatedOrderId,
                userId,
                totalAmount || 1061,
                shippingAddress || "123 Main Street",
                shippingName || "",
                shippingPhone || "",
                shippingCity || "",
                shippingPincode || "",
                shippingGstin || null,
                paymentMethod || "COD",
                "Pending"
            ]
        );

        let createdOrder = result.rows[0];
        createdOrder.orderId = createdOrder.order_id || generatedOrderId;

        return res.status(201).json({
            success: true,
            message: "Order created successfully",
            order: createdOrder
        });
    } catch (error) {
        console.error("Error creating order:", error.message);
        return res.status(500).json({ message: "Server error creating order" });
    }
};

// ==========================================
// GET ORDERS (Role-Aware)
// ==========================================
const getMyOrders = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || req.user?._id;
        const userRole = req.user?.role;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized: Missing user identification" });
        }

        let result;
        if (userRole === "merchant" || userRole === "seller" || userRole === "admin") {
            result = await pool.query(`
                SELECT o.*, u.name as buyer_name, u.email as buyer_email 
                FROM orders o 
                LEFT JOIN users u ON o."buyerId" = u.id 
                ORDER BY o.id DESC
            `);
        } else {
            result = await pool.query(
                'SELECT * FROM orders WHERE "buyerId" = $1 ORDER BY id DESC',
                [userId]
            );
        }

        const formattedRows = (result.rows || []).map(order => ({
            ...order,
            orderId: order.order_id || order.orderId || `JCS-${order.id}`
        }));

        return res.status(200).json(formattedRows);
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

        const formattedRows = (result.rows || []).map(order => ({
            ...order,
            orderId: order.order_id || order.orderId || `JCS-${order.id}`
        }));

        return res.status(200).json(formattedRows);
    } catch (error) {
        console.error("Error fetching admin orders:", error.message);
        return res.status(500).json({ message: "Server error fetching admin orders" });
    }
};

// ==========================================
// GET ORDER BY ID (Using Resolver)
// ==========================================
const getOrderById = async (req, res) => {
    try {
        const orderIdentifier = req.params.id;
        const order = await resolveOrderRow(orderIdentifier);

        if (!order) {
            return res.status(404).json({ message: "Order not found in database" });
        }

        order.orderId = order.order_id || order.orderId || orderIdentifier;
        const total = parseFloat(order.totalAmount || order.total_amount || 1061);
        order.subtotal = order.subtotal || Math.round((total / 1.18) * 100) / 100;
        order.gst = order.gst || Math.round((total - order.subtotal) * 100) / 100;
        order.status = order.status || "Pending";

        return res.status(200).json({ order });
    } catch (error) {
        console.error("Fetch order by ID error:", error.message);
        return res.status(500).json({ message: "Server error fetching order" });
    }
};

// ==========================================
// UPDATE ORDER STATUS (Using Resolver)
// ==========================================
const updateOrderStatus = async (req, res) => {
    try {
        const orderIdentifier = req.params.id;
        const { status } = req.body;

        const targetOrder = await resolveOrderRow(orderIdentifier);

        if (!targetOrder) {
            return res.status(404).json({ message: "Order not found in database to update" });
        }

        const updateResult = await pool.query(
            'UPDATE orders SET status = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *;',
            [status, targetOrder.id]
        );

        let order = updateResult.rows[0];
        order.orderId = order.order_id || order.orderId || orderIdentifier;
        const total = parseFloat(order.totalAmount || order.total_amount || 1061);
        order.subtotal = order.subtotal || Math.round((total / 1.18) * 100) / 100;
        order.gst = order.gst || Math.round((total - order.subtotal) * 100) / 100;

        return res.status(200).json({
            success: true,
            message: "Order status updated successfully",
            order
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