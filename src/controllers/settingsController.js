const pool = require('../config/db');

// GET Discount Modes
const getDiscountModes = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM discount_modes ORDER BY label');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST Create Discount Mode
const createDiscountMode = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const mode = req.body;
        
        await connection.beginTransaction();
        
        const query = `
            INSERT INTO discount_modes 
            (id, label, description, is_active, is_system)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        await connection.query(query, [
            mode.id,
            mode.label,
            mode.description,
            mode.isActive !== undefined ? mode.isActive : true,
            mode.isSystem !== undefined ? mode.isSystem : false
        ]);
        
        await connection.commit();
        res.status(201).json({ message: 'Discount mode created' });
        
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

// PUT Update Discount Mode
const updateDiscountMode = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        const updates = req.body;
        
        await connection.beginTransaction();
        
        const query = `
            UPDATE discount_modes 
            SET label = ?, description = ?, is_active = ?
            WHERE id = ?
        `;
        
        await connection.query(query, [
            updates.label,
            updates.description,
            updates.isActive,
            id
        ]);
        
        await connection.commit();
        res.json({ message: 'Discount mode updated' });
        
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

// DELETE Discount Mode
const deleteDiscountMode = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        
        // Check if system mode
        const [mode] = await connection.query(
            'SELECT is_system FROM discount_modes WHERE id = ?', 
            [id]
        );
        
        if (mode.length > 0 && mode[0].is_system) {
            return res.status(400).json({ error: 'Cannot delete system discount mode' });
        }
        
        await connection.query('DELETE FROM discount_modes WHERE id = ?', [id]);
        res.json({ message: 'Discount mode deleted' });
        
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

module.exports = {
    getDiscountModes,
    createDiscountMode,
    updateDiscountMode,
    deleteDiscountMode
};
