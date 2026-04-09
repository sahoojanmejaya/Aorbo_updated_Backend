const pool = require('../config/db');

// --- Helper: Generate Coupon Code ---
const generateCouponCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// GET All Coupons
const getAllCoupons = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM coupons ORDER BY created_at DESC');
        // We might need to parse JSON fields if the driver doesn't do it automatically for some types, 
        // but mysql2 usually handles JSON columns well. 
        // However, let's map to ensure 'config' is parsed if it comes as string.
        const coupons = rows.map(row => ({
            ...row,
            config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
            affectedTreks: typeof row.affected_treks === 'string' ? JSON.parse(row.affected_treks) : row.affected_treks,
            excludedTreks: typeof row.excluded_treks === 'string' ? JSON.parse(row.excluded_treks) : row.excluded_treks,
            targetVendorIds: typeof row.target_vendor_ids === 'string' ? JSON.parse(row.target_vendor_ids) : row.target_vendor_ids
        }));
        res.json(coupons);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST Create Coupon
const createCoupon = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const coupon = req.body;

        // Log received data for debugging
        console.log('Received coupon data:', JSON.stringify(coupon, null, 2));

        // Validation: PARTNER and SPECIAL_DEALS coupons must have a vendor_id
        if ((coupon.scope === 'PARTNER' || coupon.scope === 'SPECIAL_DEALS') && !coupon.vendor_id && !coupon.vendorId) {
            const scopeName = coupon.scope === 'PARTNER' ? 'PARTNER' : 'SPECIAL_DEALS';
            return res.status(400).json({ error: `${scopeName} Coupons must be vendor dependent` });
        }

        // Auto-generate code if missing
        if (!coupon.code) {
            coupon.code = generateCouponCode();
        }

        // ID generation
        const id = coupon.id || `CPN-${Math.floor(1000 + Math.random() * 9000)}`;

        await connection.beginTransaction();

        const query = `
      INSERT INTO coupons 
      (id, code, description, status, scope, mode, discount_type, discount_value, 
       usage_count, total_usage_limit, user_limit, 
       auto_apply, target_condition, target_vendor_ids,
       valid_from, valid_until, 
       min_order_value, max_discount,
       affected_treks, excluded_treks, 
       config, created_by, vendor_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

        await connection.query(query, [
            id,
            coupon.code.toUpperCase(),
            coupon.description,
            coupon.status || 'DRAFT',
            coupon.scope,
            coupon.mode,
            coupon.mode?.toLowerCase() || 'percentage', // discount_type
            coupon.discount_value || coupon.discountValue || (coupon.config ? coupon.config.discountValue : 0),
            0, // initial usage
            coupon.total_usage_limit || coupon.totalUsageLimit || 100,
            coupon.user_limit || coupon.userLimit || 1,
            coupon.auto_apply || coupon.autoApply || false,
            coupon.target_condition || coupon.targetCondition || 'NONE',
            JSON.stringify(coupon.target_vendor_ids || coupon.targetVendorIds || []),

            coupon.valid_from || coupon.validFrom,
            coupon.valid_until || coupon.validUntil || coupon.validTill, // Handle all field name variations

            coupon.min_order_value || coupon.minOrderValue || (coupon.config ? coupon.config.minOrderValue : 0),
            coupon.max_discount || coupon.maxDiscount || (coupon.config ? coupon.config.maxDiscount : null),

            JSON.stringify(coupon.affected_treks || coupon.affectedTreks || []),
            JSON.stringify(coupon.excluded_treks || coupon.excludedTreks || []),

            JSON.stringify(coupon.config || {}), // Store the full config JSON

            coupon.created_by || coupon.createdBy || 'Admin',
            coupon.vendor_id || coupon.vendorId || null // Add vendor_id, allow NULL
        ]);

        // Audit Log
        await connection.query(`
      INSERT INTO audit_logs (id, timestamp, performer_id, performer_name, action, entity_id, entity_name, details, module)
      VALUES (?, NOW(), ?, ?, 'CREATED', ?, ?, ?, 'COUPON')
    `, [
            `LOG-${Date.now()}`,
            coupon.createdById || 'SYS',
            coupon.createdBy || 'System',
            id,
            coupon.code,
            'Created new coupon campaign'
        ]);

        await connection.commit();
        res.status(201).json({ message: 'Coupon created successfully', id, code: coupon.code });

    } catch (err) {
        await connection.rollback();
        console.error("Create Coupon Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

// PUT Update Coupon
const updateCoupon = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const query = `
      UPDATE coupons SET 
        description = ?, status = ?, scope = ?, mode = ?, discount_value = ?,
        total_usage_limit = ?, user_limit = ?,
        auto_apply = ?, target_condition = ?, target_vendor_ids = ?,
        valid_from = ?, valid_until = ?, 
        min_order_value = ?, max_discount = ?, 
        affected_treks = ?, excluded_treks = ?,
        config = ?
      WHERE id = ?
    `;

        await connection.query(query, [
            updates.description,
            updates.status,
            updates.scope,
            updates.mode,
            updates.discountValue,
            updates.totalUsageLimit,
            updates.userLimit,
            updates.autoApply,
            updates.targetCondition,
            JSON.stringify(updates.targetVendorIds || []),
            updates.validFrom,
            updates.validTill,
            updates.minOrderValue,
            updates.maxDiscount,
            JSON.stringify(updates.affectedTreks || []),
            JSON.stringify(updates.excludedTreks || []),
            JSON.stringify(updates.config || {}),
            id
        ]);

        // Audit Log
        await connection.query(`
      INSERT INTO audit_logs (id, timestamp, performer_id, performer_name, action, entity_id, entity_name, details, module)
      VALUES (?, NOW(), ?, ?, 'EDITED', ?, ?, ?, 'COUPON')
    `, [
            `LOG-${Date.now()}`,
            updates.updatedById || 'SYS',
            updates.updatedBy || 'System',
            id,
            updates.code || 'Unknown',
            'Updated coupon configuration'
        ]);

        await connection.commit();
        res.json({ message: 'Coupon updated' });

    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

// PATCH Toggle Status
const toggleStatus = async (req, res) => {
    const { id } = req.params;
    const { status, performerId, performerName } = req.body;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('UPDATE coupons SET status = ? WHERE id = ?', [status, id]);

        await connection.query(`
      INSERT INTO audit_logs (id, timestamp, performer_id, performer_name, action, entity_id, entity_name, details, module)
      VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, 'COUPON')
    `, [
            `LOG-${Date.now()}`,
            performerId || 'SYS',
            performerName || 'Admin',
            status === 'ACTIVE' ? 'ACTIVATED' : 'DEACTIVATED',
            id,
            'Unknown',
            `Status changed to ${status}`
        ]);

        await connection.commit();
        res.json({ message: `Coupon status updated to ${status}` });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

// DELETE Coupon
const deleteCoupon = async (req, res) => {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
        // Soft delete
        await connection.query('UPDATE coupons SET status = "DELETED", deleted_at = NOW() WHERE id = ?', [id]);
        res.json({ message: 'Coupon deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

module.exports = {
    getAllCoupons,
    createCoupon,
    updateCoupon,
    toggleStatus,
    deleteCoupon
};
