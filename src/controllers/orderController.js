const dbPool = require("../config/db");
const pool = dbPool.pool || dbPool;

// ==========================================
// AUTO-MIGRATION
// ==========================================
(async () => {
    try {
        await pool.query(
            'ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_id TEXT;'
        );

        await pool.query(
            'ALTER TABLE orders ADD COLUMN IF NOT EXISTS items JSONB;'
        );

        await pool.query(
            'ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_email TEXT;'
        );

        await pool.query(
            'ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method_title TEXT;'
        );
    } catch (err) {
        console.error("Order migration warning:", err.message);
    }
})();


// ==========================================
// HELPER: ROBUST ORDER RESOLUTION
// ==========================================
async function resolveOrderRow(orderIdentifier) {
    if (!orderIdentifier) return null;

    const identifier = String(orderIdentifier).trim();

    // 1. Exact string match
    try {
        const stringMatch = await pool.query(
            `SELECT *
             FROM orders
             WHERE order_id = $1
                OR "orderId" = $1
                OR CAST(id AS TEXT) = $1
             LIMIT 1`,
            [identifier]
        );

        if (stringMatch.rows.length > 0) {
            return stringMatch.rows[0];
        }
    } catch (e) {
        console.error("Exact order lookup error:", e.message);
    }


    // 2. Numeric ID lookup
    try {
        const numericStr = identifier.replace(/\D/g, "");

        if (numericStr) {
            const numericId = parseInt(numericStr, 10);

            if (!Number.isNaN(numericId)) {
                const numericMatch = await pool.query(
                    `SELECT *
                     FROM orders
                     WHERE id = $1
                     LIMIT 1`,
                    [numericId]
                );

                if (numericMatch.rows.length > 0) {
                    return numericMatch.rows[0];
                }
            }
        }
    } catch (e) {
        console.error("Numeric order lookup error:", e.message);
    }


    // 3. Partial order ID lookup
    try {
        const likeMatch = await pool.query(
            `SELECT *
             FROM orders
             WHERE order_id ILIKE $1
                OR "orderId" ILIKE $1
             ORDER BY id DESC
             LIMIT 1`,
            [`%${identifier}%`]
        );

        if (likeMatch.rows.length > 0) {
            return likeMatch.rows[0];
        }
    } catch (e) {
        console.error("Partial order lookup error:", e.message);
    }


    // IMPORTANT:
    // Do NOT automatically return the latest order here.
    // That can update the WRONG order if the ID is incorrect.

    return null;
}


// ==========================================
// HELPER: FORMAT ORDER
// ==========================================
const formatOrder = (order) => {
    if (!order) return null;

    let parsedItems = order.items;

    if (typeof parsedItems === "string") {
        try {
            parsedItems = JSON.parse(parsedItems);
        } catch (err) {
            parsedItems = [];
        }
    }

    if (!Array.isArray(parsedItems)) {
        parsedItems = [];
    }


    // Normalize status
    const rawStatus = String(
        order.status || "Pending"
    ).trim().toLowerCase();

    let normalizedStatus = "Pending";

    if (
        rawStatus === "delivered" ||
        rawStatus === "complete" ||
        rawStatus === "completed"
    ) {
        normalizedStatus = "Delivered";
    } else if (
        rawStatus === "shipped" ||
        rawStatus === "dispatched"
    ) {
        normalizedStatus = "Shipped";
    } else if (
        rawStatus === "processing" ||
        rawStatus === "packed"
    ) {
        normalizedStatus = "Processing";
    } else if (
        rawStatus === "cancelled" ||
        rawStatus === "canceled"
    ) {
        normalizedStatus = "Cancelled";
    } else if (
        rawStatus === "pending" ||
        rawStatus === "placed"
    ) {
        normalizedStatus = "Pending";
    } else {
        normalizedStatus =
            rawStatus.charAt(0).toUpperCase() +
            rawStatus.slice(1);
    }


    return {
        ...order,

        orderId:
            order.order_id ||
            order.orderId ||
            `JCS-${order.id}`,

        items: parsedItems,

        shipping_email:
            order.shipping_email ||
            order.buyer_email ||
            order.email ||
            "N/A",

        status: normalizedStatus,

        rawStatus: order.status
    };
};


// ==========================================
// CREATE ORDER
// ==========================================
const createOrder = async (req, res) => {
    try {
        const userId =
            req.user?.id ||
            req.user?.userId ||
            req.user?._id;

        const {
            orderId,
            items,
            totalAmount,
            shippingAddress,
            shippingName,
            shippingEmail,
            shippingPhone,
            shippingCity,
            shippingPincode,
            shippingGstin,
            paymentMethod,
            payment_method_title
        } = req.body;


        if (!userId) {
            return res.status(401).json({
                message: "Unauthorized: Missing user ID"
            });
        }


        const generatedOrderId =
            orderId ||
            `JCS-${Math.floor(10000 + Math.random() * 90000)}`;


        const parsedItems = JSON.stringify(
            items || [
                {
                    title: "Product Item",
                    quantity: 1,
                    price: totalAmount || 1061
                }
            ]
        );


        const result = await pool.query(
            `INSERT INTO orders (
                order_id,
                "buyerId",
                items,
                "totalAmount",
                "shippingAddress",
                "shippingName",
                shipping_email,
                "shippingPhone",
                "shippingCity",
                "shippingPincode",
                "shippingGstin",
                "paymentMethod",
                payment_method_title,
                status,
                "createdAt",
                "updatedAt"
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                $12,
                $13,
                $14,
                NOW(),
                NOW()
            )
            RETURNING *;`,
            [
                generatedOrderId,
                userId,
                parsedItems,
                totalAmount || 1061,
                shippingAddress || "123 Main Street",
                shippingName || "",
                shippingEmail || "",
                shippingPhone || "",
                shippingCity || "",
                shippingPincode || "",
                shippingGstin || null,
                paymentMethod || "COD",
                payment_method_title ||
                (
                    paymentMethod === "online"
                        ? "Razorpay"
                        : "Cash on Delivery"
                ),
                "Pending"
            ]
        );


        const createdOrder = formatOrder(
            result.rows[0]
        );


        return res.status(201).json({
            success: true,
            message: "Order created successfully",
            order: createdOrder
        });

    } catch (error) {

        console.error(
            "Error creating order:",
            error.message
        );

        return res.status(500).json({
            message: "Server error creating order",
            error: error.message
        });
    }
};


// ==========================================
// GET CUSTOMER ORDERS
// ==========================================
const getMyOrders = async (req, res) => {
    try {

        const userId =
            req.user?.id ||
            req.user?.userId ||
            req.user?._id;

        const userRole = req.user?.role;


        if (!userId) {
            return res.status(401).json({
                message:
                    "Unauthorized: Missing user identification"
            });
        }


        let result;


        // Admin / merchant can see all orders
        if (
            userRole === "merchant" ||
            userRole === "seller" ||
            userRole === "admin"
        ) {

            result = await pool.query(`
                SELECT
                    o.*,
                    u.name AS buyer_name,
                    u.email AS buyer_email
                FROM orders o
                LEFT JOIN users u
                    ON o."buyerId" = u.id
                ORDER BY o.id DESC
            `);

        } else {

            result = await pool.query(
                `
                SELECT
                    o.*,
                    u.name AS buyer_name,
                    u.email AS buyer_email
                FROM orders o
                LEFT JOIN users u
                    ON o."buyerId" = u.id
                WHERE o."buyerId" = $1
                ORDER BY o.id DESC
                `,
                [userId]
            );
        }


        const formattedRows =
            (result.rows || []).map(formatOrder);


        return res.status(200).json({
            success: true,
            orders: formattedRows
        });

    } catch (error) {

        console.error(
            "Error fetching orders:",
            error.message
        );

        return res.status(500).json({
            message:
                "Server error fetching your orders"
        });
    }
};


// ==========================================
// GET ALL ORDERS - ADMIN
// ==========================================
const getAllOrders = async (req, res) => {
    try {

        const result = await pool.query(`
            SELECT
                o.*,
                u.name AS buyer_name,
                u.email AS buyer_email
            FROM orders o
            LEFT JOIN users u
                ON o."buyerId" = u.id
            ORDER BY o.id DESC
        `);


        const formattedRows =
            (result.rows || []).map(formatOrder);


        return res.status(200).json({
            success: true,
            orders: formattedRows
        });

    } catch (error) {

        console.error(
            "Error fetching admin orders:",
            error.message
        );

        return res.status(500).json({
            message:
                "Server error fetching admin orders"
        });
    }
};


// ==========================================
// GET SINGLE ORDER
// ==========================================
const getOrderById = async (req, res) => {
    try {

        const orderIdentifier =
            req.params.id;


        const orderRow =
            await resolveOrderRow(
                orderIdentifier
            );


        if (!orderRow) {
            return res.status(404).json({
                message:
                    "Order not found in database"
            });
        }


        let order = orderRow;


        if (orderRow.buyerId) {

            const userQuery =
                await pool.query(
                    `
                    SELECT name, email
                    FROM users
                    WHERE id = $1
                    `,
                    [orderRow.buyerId]
                );


            if (userQuery.rows.length > 0) {

                order.buyer_name =
                    userQuery.rows[0].name;

                order.buyer_email =
                    userQuery.rows[0].email;
            }
        }


        const formattedOrder =
            formatOrder(order);


        return res.status(200).json({
            success: true,
            order: formattedOrder
        });

    } catch (error) {

        console.error(
            "Fetch order by ID error:",
            error.message
        );

        return res.status(500).json({
            message:
                "Server error fetching order"
        });
    }
};


// ==========================================
// UPDATE ORDER STATUS
// ==========================================
const updateOrderStatus = async (req, res) => {
    try {

        const orderIdentifier =
            req.params.id;

        let { status } = req.body;


        if (!status) {
            return res.status(400).json({
                message:
                    "Order status is required"
            });
        }


        // Normalize status before saving
        status = String(status)
            .trim()
            .toLowerCase();


        const allowedStatuses = [
            "pending",
            "processing",
            "shipped",
            "delivered",
            "cancelled"
        ];


        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                message:
                    "Invalid order status"
            });
        }


        const targetOrder =
            await resolveOrderRow(
                orderIdentifier
            );


        if (!targetOrder) {
            return res.status(404).json({
                message:
                    `Order ${orderIdentifier} not found in database`
            });
        }


        const updateResult =
            await pool.query(
                `
                UPDATE orders
                SET
                    status = $1,
                    "updatedAt" = NOW()
                WHERE id = $2
                RETURNING *;
                `,
                [
                    status,
                    targetOrder.id
                ]
            );


        if (
            !updateResult.rows ||
            updateResult.rows.length === 0
        ) {
            return res.status(500).json({
                message:
                    "Order status was not updated"
            });
        }


        const order =
            formatOrder(
                updateResult.rows[0]
            );


        console.log(
            `Order ${order.orderId} status updated to ${order.status}`
        );


        return res.status(200).json({
            success: true,
            message:
                "Order status updated successfully",
            order
        });

    } catch (error) {

        console.error(
            "Error updating order status:",
            error.message
        );

        return res.status(500).json({
            message:
                "Server error updating order status",
            error: error.message
        });
    }
};


// ==========================================
// EXPORTS
// ==========================================
module.exports = {
    createOrder,
    getMyOrders,
    getAllOrders,
    getOrderById,
    updateOrderStatus
};