const pool = require('../config/db');

const getAllBadges = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM badges ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const createBadge = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const badge = req.body;
        if (!badge.id) badge.id = `CTA-${Math.floor(1000 + Math.random() * 9000)}`;

        await connection.beginTransaction();

        const query = `
      INSERT INTO badges 
      (id, name, description, tier, status, styling, gold_limits, platinum_limits, expiry_date, created_by_id, created_by_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

        await connection.query(query, [
            badge.id,
            badge.name,
            badge.description,
            badge.tier,
            badge.status || 'ACTIVE',
            JSON.stringify(badge.styling),
            JSON.stringify(badge.goldLimits),
            JSON.stringify(badge.platinumLimits),
            badge.expiryDate,
            badge.createdById,
            badge.creatorName
        ]);

        // Log Action
        await connection.query(`
      INSERT INTO audit_logs (id, timestamp, performer_id, performer_name, action, entity_id, entity_name, details, module)
      VALUES (?, NOW(), ?, ?, 'CREATED', ?, ?, ?, 'BADGE')
    `, [
            `LOG-${Date.now()}`,
            badge.createdById || 'SYS',
            badge.creatorName || 'System',
            badge.id,
            badge.name,
            'Initial creation of badge module'
        ]);

        await connection.commit();
        res.status(201).json({ message: 'Badge created successfully', id: badge.id });

    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

const updateBadge = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const query = `
      UPDATE badges SET 
        name = ?, description = ?, tier = ?, styling = ?, 
        gold_limits = ?, platinum_limits = ?, expiry_date = ?,
        last_action_at = NOW(), last_action_by = ?
      WHERE id = ?
    `;

        await connection.query(query, [
            updates.name,
            updates.description,
            updates.tier,
            JSON.stringify(updates.styling),
            JSON.stringify(updates.goldLimits),
            JSON.stringify(updates.platinumLimits),
            updates.expiryDate,
            updates.lastActionBy || 'Admin',
            id
        ]);

        // Audit Log
        await connection.query(`
      INSERT INTO audit_logs (id, timestamp, performer_id, performer_name, action, entity_id, entity_name, details, module)
      VALUES (?, NOW(), ?, ?, 'EDITED', ?, ?, ?, 'BADGE')
    `, [
            `LOG-${Date.now()}`,
            updates.lastActionById || 'SYS',
            updates.lastActionBy || 'Admin',
            id,
            updates.name,
            'Updated badge configuration'
        ]);

        await connection.commit();
        res.json({ message: 'Badge updated' });

    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

const toggleStatus = async (req, res) => {
    const { id } = req.params;
    const { status, performerId, performerName } = req.body;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        await connection.query('UPDATE badges SET status = ?, last_action_at = NOW() WHERE id = ?', [status, id]);

        // Audit Log
        await connection.query(`
      INSERT INTO audit_logs (id, timestamp, performer_id, performer_name, action, entity_id, entity_name, details, module)
      VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, 'BADGE')
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
        res.json({ message: `Status updated to ${status}` });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

const deleteBadge = async (req, res) => {
    const { id } = req.params;
    const { performerId, performerName } = req.query;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Soft delete
        await connection.query('UPDATE badges SET status = "DELETED", deleted_at = NOW() WHERE id = ?', [id]);

        await connection.query(`
      INSERT INTO audit_logs (id, timestamp, performer_id, performer_name, action, entity_id, entity_name, details, module)
      VALUES (?, NOW(), ?, ?, 'DELETED', ?, 'Unknown', 'Badge marked for deletion', 'BADGE')
    `, [
            `LOG-${Date.now()}`,
            performerId || 'SYS',
            performerName || 'Admin',
            id
        ]);

        await connection.commit();
        res.json({ message: 'Badge deleted' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

module.exports = {
    getAllBadges,
    createBadge,
    updateBadge,
    toggleStatus,
    deleteBadge
};
