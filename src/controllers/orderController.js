const dbPool = require("../config/db");
const pool = dbPool.pool || dbPool;

// ==========================================
// AUTO-MIGRATION
// ==========================================
(async () => {
    try {
        await pool.query(`
            ALTER TABLE orders
            ADD COLUMN IF NOT EXISTS order_id TEXT;
        `);

        await pool.query(`
            ALTER TABLE orders
            ADD COLUMN IF NOT EXISTS items JSONB;
        `);

        await pool.query(`
            ALTER TABLE orders
            ADD COLUMN IF NOT EXISTS shipping_email TEXT;
        `);

        await pool.query(`
            ALTER TABLE orders
            ADD COLUMN IF NOT EXISTS payment_method_title TEXT;
        `);

        console.log("Order table migration check completed.");
    } catch (err) {
        console.error(
            "Order migration warning:",
            err.message
        );
    }
})();


// ==========================================
// HELPER: RESOLVE ORDER
// ==========================================

async function resolveOrderRow(orderIdentifier) {

    if (!orderIdentifier) {
        return null;
    }

    const identifier =
        String(orderIdentifier).trim();


    // ==========================================
    // 1. EXACT MATCH
    // Search using order_id OR database id
    // ==========================================

    try {

        const result = await pool.query(
            `
            SELECT *
            FROM orders
            WHERE order_id = $1
               OR CAST(id AS TEXT) = $1
            LIMIT 1
            `,
            [identifier]
        );

        if (result.rows.length > 0) {

            return result.rows[0];

        }

    } catch (error) {

        console.error(
            "Exact order lookup error:",
            error.message
        );

    }


    // ==========================================
    // 2. NUMERIC ID MATCH
    // ==========================================

    try {

        const numericStr =
            identifier.replace(/\D/g, "");

        if (numericStr) {

            const numericId =
                parseInt(numericStr, 10);

            if (!Number.isNaN(numericId)) {

                const result =
                    await pool.query(
                        `
                        SELECT *
                        FROM orders
                        WHERE id = $1
                        LIMIT 1
                        `,
                        [numericId]
                    );

                if (result.rows.length > 0) {

                    return result.rows[0];

                }

            }

        }

    } catch (error) {

        console.error(
            "Numeric order lookup error:",
            error.message
        );

    }


    // ==========================================
    // 3. PARTIAL ORDER ID MATCH
    // ==========================================

    try {

        const result =
            await pool.query(
                `
                SELECT *
                FROM orders
                WHERE order_id ILIKE $1
                ORDER BY id DESC
                LIMIT 1
                `,
                [`%${identifier}%`]
            );

        if (result.rows.length > 0) {

            return result.rows[0];

        }

    } catch (error) {

        console.error(
            "Partial order lookup error:",
            error.message
        );

    }


    // IMPORTANT:
    // Never automatically return the latest order.
    // That could update the wrong customer's order.

    return null;
}



// ==========================================
// HELPER: FORMAT ORDER
// ==========================================

const formatOrder = (order) => {

    if (!order) {
        return null;
    }


    // ==========================================
    // PARSE ITEMS
    // ==========================================

    let parsedItems = order.items;

    if (typeof parsedItems === "string") {

        try {

            parsedItems =
                JSON.parse(parsedItems);

        } catch (error) {

            parsedItems = [];

        }

    }

    if (!Array.isArray(parsedItems)) {

        parsedItems = [];

    }


    // ==========================================
    // NORMALIZE STATUS
    // ==========================================

    const rawStatus =
        String(
            order.status || "Pending"
        )
            .trim()
            .toLowerCase();


    let normalizedStatus = "Pending";


    if (
        rawStatus === "delivered" ||
        rawStatus === "complete" ||
        rawStatus === "completed"
    ) {

        normalizedStatus = "Delivered";

    }

    else if (
        rawStatus === "shipped" ||
        rawStatus === "dispatched"
    ) {

        normalizedStatus = "Shipped";

    }

    else if (
        rawStatus === "processing" ||
        rawStatus === "packed"
    ) {

        normalizedStatus = "Processing";

    }

    else if (
        rawStatus === "out_for_delivery" ||
        rawStatus === "out-for-delivery" ||
        rawStatus === "out for delivery"
    ) {

        normalizedStatus = "Out for Delivery";

    }

    else if (
        rawStatus === "cancelled" ||
        rawStatus === "canceled"
    ) {

        normalizedStatus = "Cancelled";

    }

    else if (
        rawStatus === "paid"
    ) {

        normalizedStatus = "Paid";

    }

    else if (
        rawStatus === "pending" ||
        rawStatus === "placed"
    ) {

        normalizedStatus = "Pending";

    }

    else {

        normalizedStatus =
            rawStatus.charAt(0).toUpperCase() +
            rawStatus.slice(1);

    }


    // ==========================================
    // RETURN FORMATTED ORDER
    // ==========================================

    return {

        ...order,

        orderId:
            order.order_id ||
            `JCS-${order.id}`,

        items:
        parsedItems,

        shipping_email:
            order.shipping_email ||
            order.buyer_email ||
            order.email ||
            "N/A",

        status:
        normalizedStatus,

        rawStatus:
        order.status

    };

};



// ==========================================
// CREATE ORDER
// POST /api/orders
// ==========================================

const createOrder = async (req, res) => {

    try {

        const userId =
            req.user?.id ||
            req.user?.userId ||
            req.user?._id;


        const {
            orderId,
            id,
            order_id,
            items,
            orderItems,
            totalAmount,
            totalPrice,
            shippingAddress,
            shippingName,
            shippingEmail,
            shippingPhone,
            shippingCity,
            shippingPincode,
            shippingGstin,
            paymentMethod,
            payment_method_title,
            status,
            paymentStatus
        } = req.body;


        // ==========================================
        // CHECK USER
        // ==========================================

        if (!userId) {

            return res.status(401).json({
                message:
                    "Unauthorized: Missing user ID"
            });

        }


        // ==========================================
        // ORDER ID
        // ==========================================

        const generatedOrderId =
            orderId ||
            order_id ||
            id ||
            `JCS-${Math.floor(
                10000 +
                Math.random() * 90000
            )}`;


        // ==========================================
        // ITEMS
        // ==========================================

        const finalItems =
            items ||
            orderItems ||
            [
                {
                    title: "Product Item",
                    quantity: 1,
                    qty: 1,
                    price:
                        totalAmount ||
                        totalPrice ||
                        1061
                }
            ];


        const parsedItems =
            JSON.stringify(finalItems);


        // ==========================================
        // TOTAL
        // ==========================================

        const finalTotal =
            totalAmount ||
            totalPrice ||
            1061;


        // ==========================================
        // STATUS
        // ==========================================

        let finalStatus =
            status ||
            paymentStatus ||
            "Pending";


        finalStatus =
            String(finalStatus)
                .trim()
                .toLowerCase();


        const allowedStatuses = [
            "pending",
            "paid",
            "processing",
            "shipped",
            "out_for_delivery",
            "delivered",
            "completed",
            "cancelled"
        ];


        if (
            !allowedStatuses.includes(
                finalStatus
            )
        ) {

            finalStatus = "pending";

        }


        // ==========================================
        // PAYMENT METHOD
        // ==========================================

        const finalPaymentMethod =
            paymentMethod ||
            "COD";


        const finalPaymentTitle =
            payment_method_title ||
            (
                finalPaymentMethod
                    .toLowerCase()
                    .includes("razorpay")
                    ? "Razorpay"
                    : finalPaymentMethod
            );


        // ==========================================
        // INSERT ORDER
        // ==========================================

        const result =
            await pool.query(
                `
                INSERT INTO orders (

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

                RETURNING *;
                `,
                [

                    generatedOrderId,

                    userId,

                    parsedItems,

                    finalTotal,

                    shippingAddress ||
                    "123 Main Street",

                    shippingName ||
                    "",

                    shippingEmail ||
                    "",

                    shippingPhone ||
                    "",

                    shippingCity ||
                    "",

                    shippingPincode ||
                    "",

                    shippingGstin ||
                    null,

                    finalPaymentMethod,

                    finalPaymentTitle,

                    finalStatus

                ]
            );


        const createdOrder =
            formatOrder(
                result.rows[0]
            );


        console.log(
            `Order created: ${createdOrder.orderId}`
        );


        return res.status(201).json({

            success: true,

            message:
                "Order created successfully",

            order:
            createdOrder

        });


    } catch (error) {

        console.error(
            "Error creating order:",
            error.message
        );


        return res.status(500).json({

            message:
                "Server error creating order",

            error:
            error.message

        });

    }

};



// ==========================================
// GET CUSTOMER ORDERS
// GET /api/orders
// ==========================================

const getMyOrders = async (req, res) => {

    try {

        const userId =
            req.user?.id ||
            req.user?.userId ||
            req.user?._id;


        const userRole =
            String(
                req.user?.role || ""
            ).toLowerCase();


        if (!userId) {

            return res.status(401).json({

                message:
                    "Unauthorized: Missing user identification"

            });

        }


        let result;


        // ==========================================
        // ADMIN / MERCHANT
        // ==========================================

        if (
            userRole === "merchant" ||
            userRole === "seller" ||
            userRole === "admin"
        ) {

            result =
                await pool.query(
                    `
                    SELECT
                        o.*,
                        u.name AS buyer_name,
                        u.email AS buyer_email
                    FROM orders o
                    LEFT JOIN users u
                        ON o."buyerId" = u.id
                    ORDER BY o.id DESC
                    `
                );

        }

            // ==========================================
            // CUSTOMER
        // ==========================================

        else {

            result =
                await pool.query(
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
            (
                result.rows || []
            ).map(formatOrder);


        return res.status(200).json({

            success: true,

            orders:
            formattedRows

        });


    } catch (error) {

        console.error(
            "Error fetching orders:",
            error.message
        );


        return res.status(500).json({

            message:
                "Server error fetching orders"

        });

    }

};



// ==========================================
// GET ALL ORDERS
// ADMIN
// GET /api/orders/admin/all
// ==========================================

const getAllOrders = async (req, res) => {

    try {

        const result =
            await pool.query(
                `
                SELECT
                    o.*,
                    u.name AS buyer_name,
                    u.email AS buyer_email
                FROM orders o
                LEFT JOIN users u
                    ON o."buyerId" = u.id
                ORDER BY o.id DESC
                `
            );


        const formattedRows =
            (
                result.rows || []
            ).map(formatOrder);


        return res.status(200).json({

            success: true,

            orders:
            formattedRows

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
// GET /api/orders/:id
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


        let order =
            orderRow;


        // ==========================================
        // GET BUYER
        // ==========================================

        if (orderRow.buyerId) {

            const userQuery =
                await pool.query(
                    `
                    SELECT
                        name,
                        email
                    FROM users
                    WHERE id = $1
                    `,
                    [
                        orderRow.buyerId
                    ]
                );


            if (
                userQuery.rows.length > 0
            ) {

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

            order:
            formattedOrder

        });


    } catch (error) {

        console.error(
            "Fetch order by ID error:",
            error.message
        );


        return res.status(500).json({

            message:
                "Server error fetching order",

            error:
            error.message

        });

    }

};



// ==========================================
// UPDATE ORDER STATUS
// PUT /api/orders/:id/status
// ==========================================

const updateOrderStatus = async (req, res) => {

    try {

        console.log(
            "===================================="
        );

        console.log(
            "STATUS UPDATE ROUTE HIT"
        );

        console.log(
            "Order ID:",
            req.params.id
        );

        console.log(
            "Request body:",
            req.body
        );

        console.log(
            "User:",
            req.user
        );

        console.log(
            "===================================="
        );


        const orderIdentifier =
            req.params.id;


        let { status } =
            req.body;


        // ==========================================
        // CHECK STATUS
        // ==========================================

        if (!status) {

            return res.status(400).json({

                message:
                    "Order status is required"

            });

        }


        // ==========================================
        // NORMALIZE STATUS
        // ==========================================

        status =
            String(status)
                .trim()
                .toLowerCase()
                .replace(/[\s-]+/g, "_");


        // ==========================================
        // ALLOWED STATUS VALUES
        // ==========================================

        const allowedStatuses = [

            "pending",

            "paid",

            "processing",

            "shipped",

            "out_for_delivery",

            "delivered",

            "completed",

            "cancelled"

        ];


        if (
            !allowedStatuses.includes(
                status
            )
        ) {

            return res.status(400).json({

                message:
                    "Invalid order status",

                allowedStatuses

            });

        }


        // ==========================================
        // FIND ORDER
        // ==========================================

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


        // ==========================================
        // UPDATE
        // ==========================================

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


        // ==========================================
        // FORMAT UPDATED ORDER
        // ==========================================

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

            error:
            error.message

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