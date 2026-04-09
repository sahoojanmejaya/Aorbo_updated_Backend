const db = require("../config/db");

/**
 * ============================================================
 * OPERATORS REPOSITORY
 * Table: vendors
 * ============================================================
 */

/**
 * Find All Operators
 */
async function findAll({ limit = 50, offset = 0, search = '' }) {
    const conditions = [];
    const values = [];

    if (search) {
        conditions.push("v.business_name LIKE ?");
        values.push(`%${search}%`);
    }

    const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const query = `
    SELECT
      v.id,
      v.business_name AS name,
      u.email,
      u.phone,
      v.kyc_status,
      v.application_status,
      v.created_at
    FROM vendors v
    LEFT JOIN users u ON u.id = v.user_id
    ${whereClause}
    ORDER BY v.created_at DESC
    LIMIT ? OFFSET ?
  `;

    const countQuery = `
    SELECT COUNT(*) AS total
    FROM vendors v
    LEFT JOIN users u ON u.id = v.user_id
    ${whereClause}
  `;

    const [rows] = await db.query(query, [...values, limit, offset]);
    const [[count]] = await db.query(countQuery, values);

    return {
        rows,
        total: count.total
    };
}

/**
 * Find Operator By ID
 */
async function findById(id) {
    const [rows] = await db.query(
        `SELECT 
           v.*, 
           u.email, 
           u.phone, 
           v.business_name AS name
         FROM vendors v
         LEFT JOIN users u ON u.id = v.user_id
         WHERE v.id = ?`,
        [id]
    );
    return rows[0] || null;
}

module.exports = {
    findAll,
    findById
};
