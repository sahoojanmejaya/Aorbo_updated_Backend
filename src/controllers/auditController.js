const pool = require('../config/db');

// GET All Audit Logs
const getAllAuditLogs = async (req, res) => {
    try {
        const { action, targetType, module, performerId, dateFrom, dateTo, page = 1, limit = 100 } = req.query;
        
        let query = 'SELECT * FROM audit_logs WHERE 1=1';
        const params = [];
        
        if (action) {
            query += ' AND action = ?';
            params.push(action);
        }
        
        // Accept both targetType and module parameters
        // Support comma-separated modules (e.g., "VENDOR,BATCH,BOOKING")
        if (targetType || module) {
            const moduleFilter = targetType || module;
            const modules = moduleFilter.split(',').map(m => m.trim());
            
            if (modules.length === 1) {
                query += ' AND module = ?';
                params.push(modules[0]);
            } else {
                const placeholders = modules.map(() => '?').join(',');
                query += ` AND module IN (${placeholders})`;
                params.push(...modules);
            }
        }
        
        if (performerId) {
            query += ' AND performer_id = ?';
            params.push(performerId);
        }
        if (dateFrom) {
            query += ' AND timestamp >= ?';
            params.push(dateFrom);
        }
        if (dateTo) {
            query += ' AND timestamp <= ?';
            params.push(dateTo);
        }
        
        query += ' ORDER BY timestamp DESC';
        
        // Get total count
        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;
        
        // Add pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);
        
        const [rows] = await pool.query(query, params);
        
        // Return in expected format
        res.json({
            logs: rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getAllAuditLogs
};
