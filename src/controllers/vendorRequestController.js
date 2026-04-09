const pool = require('../config/db');

// GET All Vendor Requests
const getAllRequests = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT * FROM vendor_requests 
            ORDER BY request_date DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST Create Vendor Request
const createRequest = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const request = req.body;
        const id = `REQ-${Date.now()}`;
        
        await connection.beginTransaction();
        
        const query = `
            INSERT INTO vendor_requests 
            (id, vendor_id, vendor_name, vendor_tier, requested_code, 
             discount_type, discount_value, trek_id, trek_name, 
             reason, conditions, status, request_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW())
        `;
        
        await connection.query(query, [
            id,
            request.vendorId,
            request.vendorName,
            request.vendorTier,
            request.requestedCode,
            request.discountType,
            request.discountValue,
            request.trekId,
            request.trekName,
            request.reason,
            request.conditions
        ]);
        
        await connection.commit();
        res.status(201).json({ message: 'Request created', id });
        
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

// PUT Approve Request
const approveRequest = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        const { processedBy } = req.body;
        
        await connection.beginTransaction();
        
        await connection.query(`
            UPDATE vendor_requests 
            SET status = 'APPROVED', processed_at = NOW(), processed_by = ?
            WHERE id = ?
        `, [processedBy, id]);
        
        await connection.commit();
        res.json({ message: 'Request approved' });
        
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

// PUT Reject Request
const rejectRequest = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        const { processedBy, reason } = req.body;
        
        await connection.beginTransaction();
        
        await connection.query(`
            UPDATE vendor_requests 
            SET status = 'REJECTED', processed_at = NOW(), processed_by = ?
            WHERE id = ?
        `, [processedBy, id]);
        
        await connection.commit();
        res.json({ message: 'Request rejected' });
        
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

module.exports = {
    getAllRequests,
    createRequest,
    approveRequest,
    rejectRequest
};
