const pool = require('../config/db');

// GET Commission Logs
const getCommissionLogs = async (req, res) => {
    try {
        const { couponCode } = req.query;
        
        let query = 'SELECT * FROM commission_logs WHERE 1=1';
        const params = [];
        
        if (couponCode) {
            query += ' AND coupon_code = ?';
            params.push(couponCode);
        }
        
        query += ' ORDER BY timestamp DESC';
        
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST Create Commission Log
const createCommissionLog = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const log = req.body;
        const id = `LOG-${Date.now()}`;
        
        await connection.beginTransaction();
        
        const query = `
            INSERT INTO commission_logs 
            (id, timestamp, action, coupon_code, amount, performer, details)
            VALUES (?, NOW(), ?, ?, ?, ?, ?)
        `;
        
        await connection.query(query, [
            id,
            log.action,
            log.couponCode,
            log.amount,
            log.performer,
            log.details
        ]);
        
        await connection.commit();
        res.status(201).json({ message: 'Commission log created' });
        
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

module.exports = {
    getCommissionLogs,
    createCommissionLog
};
