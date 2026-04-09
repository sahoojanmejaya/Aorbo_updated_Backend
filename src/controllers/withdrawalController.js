const pool = require('../config/db');

// GET All Withdrawal Requests
const getAllWithdrawals = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT * FROM withdrawal_requests 
            ORDER BY requested_at DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST Create Withdrawal Request
const createWithdrawal = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const withdrawal = req.body;
        const id = `WD-${Date.now()}`;
        
        await connection.beginTransaction();
        
        const query = `
            INSERT INTO withdrawal_requests 
            (id, user_id, coupon_code, influencer_name, amount, 
             pending_at_request, status, requested_at)
            VALUES (?, ?, ?, ?, ?, ?, 'PENDING', NOW())
        `;
        
        await connection.query(query, [
            id,
            withdrawal.userId,
            withdrawal.couponCode,
            withdrawal.influencerName,
            withdrawal.amount,
            withdrawal.pendingAtRequest
        ]);
        
        await connection.commit();
        res.status(201).json({ message: 'Withdrawal request created', id });
        
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

// PUT Approve Withdrawal
const approveWithdrawal = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        const { processedBy } = req.body;
        
        await connection.beginTransaction();
        
        await connection.query(`
            UPDATE withdrawal_requests 
            SET status = 'APPROVED', processed_at = NOW(), processed_by = ?
            WHERE id = ?
        `, [processedBy, id]);
        
        // Create commission log
        const [withdrawal] = await connection.query(
            'SELECT * FROM withdrawal_requests WHERE id = ?', 
            [id]
        );
        
        if (withdrawal.length > 0) {
            await connection.query(`
                INSERT INTO commission_logs 
                (id, timestamp, action, coupon_code, amount, performer, details)
                VALUES (?, NOW(), 'WITHDRAWAL_APPROVED', ?, ?, ?, ?)
            `, [
                `LOG-${Date.now()}`,
                withdrawal[0].coupon_code,
                withdrawal[0].amount,
                processedBy,
                `Withdrawal ${id} approved`
            ]);
        }
        
        await connection.commit();
        res.json({ message: 'Withdrawal approved' });
        
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

// PUT Reject Withdrawal
const rejectWithdrawal = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        const { processedBy, rejectionReason } = req.body;
        
        await connection.beginTransaction();
        
        await connection.query(`
            UPDATE withdrawal_requests 
            SET status = 'REJECTED', processed_at = NOW(), 
                processed_by = ?, rejection_reason = ?
            WHERE id = ?
        `, [processedBy, rejectionReason, id]);
        
        // Create commission log
        const [withdrawal] = await connection.query(
            'SELECT * FROM withdrawal_requests WHERE id = ?', 
            [id]
        );
        
        if (withdrawal.length > 0) {
            await connection.query(`
                INSERT INTO commission_logs 
                (id, timestamp, action, coupon_code, amount, performer, details)
                VALUES (?, NOW(), 'WITHDRAWAL_REJECTED', ?, ?, ?, ?)
            `, [
                `LOG-${Date.now()}`,
                withdrawal[0].coupon_code,
                withdrawal[0].amount,
                processedBy,
                `Withdrawal ${id} rejected: ${rejectionReason}`
            ]);
        }
        
        await connection.commit();
        res.json({ message: 'Withdrawal rejected' });
        
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

module.exports = {
    getAllWithdrawals,
    createWithdrawal,
    approveWithdrawal,
    rejectWithdrawal
};
