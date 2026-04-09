const pool = require('../config/db');

// GET All Redemptions
const getAllRedemptions = async (req, res) => {
    try {
        const { couponCode, scope, status, dateFrom, dateTo } = req.query;
        
        let query = 'SELECT * FROM coupon_redemptions WHERE 1=1';
        const params = [];
        
        if (couponCode) {
            query += ' AND coupon_code = ?';
            params.push(couponCode);
        }
        if (scope) {
            query += ' AND scope = ?';
            params.push(scope);
        }
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        if (dateFrom) {
            query += ' AND redeemed_at >= ?';
            params.push(dateFrom);
        }
        if (dateTo) {
            query += ' AND redeemed_at <= ?';
            params.push(dateTo);
        }
        
        query += ' ORDER BY redeemed_at DESC';
        
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET Dashboard Statistics
const getStats = async (req, res) => {
    try {
        // Total Revenue
        const [revenueResult] = await pool.query(`
            SELECT COALESCE(SUM(booking_amount), 0) as totalRevenue 
            FROM coupon_redemptions 
            WHERE status = 'CONFIRMED'
        `);
        
        // Active Coupons
        const [activeCouponsResult] = await pool.query(`
            SELECT COUNT(*) as activeCoupons 
            FROM coupons 
            WHERE status = 'ACTIVE'
        `);
        
        // Total Redemptions
        const [redemptionsResult] = await pool.query(`
            SELECT COUNT(*) as totalRedemptions 
            FROM coupon_redemptions 
            WHERE status = 'CONFIRMED'
        `);
        
        // Total Savings
        const [savingsResult] = await pool.query(`
            SELECT COALESCE(SUM(discount_amount), 0) as totalSavings 
            FROM coupon_redemptions 
            WHERE status = 'CONFIRMED'
        `);
        
        res.json({
            totalRevenue: revenueResult[0].totalRevenue,
            activeCoupons: activeCouponsResult[0].activeCoupons,
            totalRedemptions: redemptionsResult[0].totalRedemptions,
            totalSavings: savingsResult[0].totalSavings
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST Create Redemption (for testing/manual entry)
const createRedemption = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const redemption = req.body;
        const id = `TXN${Date.now()}`;
        
        await connection.beginTransaction();
        
        const query = `
            INSERT INTO coupon_redemptions 
            (id, customer_id, user_name, coupon_code, scope, booking_id, trek_name, trek_id,
             discount_amount, booking_amount, platform, vendor_name, vendor_id, 
             influencer_name, status, commission_base_amount, commission_rate, 
             commission_amount, commission_status, redeemed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        
        await connection.query(query, [
            id,
            redemption.userId,
            redemption.userName,
            redemption.couponCode,
            redemption.scope,
            redemption.bookingRef,
            redemption.trekName,
            redemption.trekId,
            redemption.discountAmount,
            redemption.bookingAmount,
            redemption.platform || 'Web',
            redemption.vendorName,
            redemption.vendorId,
            redemption.influencerName,
            redemption.status || 'CONFIRMED',
            redemption.commissionBaseAmount || 0,
            redemption.commissionRate || '-',
            redemption.commissionAmount || 0,
            redemption.commissionStatus || 'PENDING'
        ]);
        
        // Update coupon usage count
        await connection.query(`
            UPDATE coupons 
            SET usage_count = usage_count + 1 
            WHERE code = ?
        `, [redemption.couponCode]);
        
        await connection.commit();
        res.status(201).json({ message: 'Redemption created', id });
        
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

module.exports = {
    getAllRedemptions,
    getStats,
    createRedemption
};
