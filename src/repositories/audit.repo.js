const db = require("../config/db");

/**
 * ============================================================
 * AUDIT REPOSITORY – FINAL, SCHEMA-SAFE
 * ============================================================
 *
 * Audit events are DERIVED from:
 * - payment_logs
 * - cancellation_bookings
 * - adjustments
 *
 * ❌ No joins to bookings / booking
 * ❌ No audit_logs table
 * ============================================================
 */

/**
 * NO-OP (kept for compatibility)
 */
async function create() {
  return true;
}

/**
 * --------------------------------------------------
 * LIST AUDIT EVENTS
 * --------------------------------------------------
 */
async function list(filters = {}, pagination = {}) {
  const { limit = 50, offset = 0 } = pagination;

  const params = [];

  const sql = `
    SELECT * FROM (
      /* ---------------- CANCELLATIONS ---------------- */
      SELECT
        cb.id                  AS id,
        cb.cancellation_date   AS actionTime,
        COALESCE(cb.performed_by_id, 'ADM-001') AS performerId,
        COALESCE(cb.performed_by_name, 'System Admin') AS performerName,
        cb.batch_id            AS tbrId,
        CONCAT('TBR', cb.batch_id) AS tbrName,
        'Agent Manually Cancelled' AS action,
        cb.reason              AS reason
      FROM cancellation_bookings cb
      LEFT JOIN customers c ON c.id = cb.customer_id

      UNION ALL

      /* ---------------- DISPUTES / REFUNDS ---------------- */
      SELECT
        a.id             AS id,
        a.created_at     AS actionTime,
        0                AS performerId,
        'Admin'          AS performerName,
        a.booking_id     AS tbrId,
        CONCAT('BOOKING-', a.booking_id) AS tbrName,
        CONCAT('DISPUTE_', a.type) AS action,
        CONCAT('Adjustment: ₹', a.amount) AS reason
      FROM adjustments a
    ) audit
    ORDER BY actionTime DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await db.query(sql, [...params, limit, offset]);

  const [[{ total }]] = await db.query(`
    SELECT COUNT(*) AS total FROM (
      SELECT id FROM cancellation_bookings
      UNION ALL
      SELECT id FROM adjustments
    ) t
  `);

  return { rows, total };
}

module.exports = {
  create,
  list
};
