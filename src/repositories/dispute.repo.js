const db = require("../config/db");

/**
 * ============================================================
 * DISPUTE (ADJUSTMENTS) REPOSITORY – MATCHES REAL SCHEMA
 * ============================================================
 *
 * TABLE USED:
 * - adjustments
 *
 * NOTE:
 * - adjustments.id = disputeId
 * - There is NO status column
 * - OPEN / RESOLVED is derived logically
 * ============================================================
 */

/**
 * --------------------------------------------------
 * CREATE DISPUTE
 * --------------------------------------------------
 */
async function create({ bookingId, type, reason }) {
  let adjustmentType = "discount";

  if (type === "REFUND_DISPUTE" || type === "BOOKING_DISPUTE") {
    adjustmentType = "refund";
  } else if (type === "PAYMENT_DISPUTE" || type === "VENDOR_DISPUTE") {
    adjustmentType = "additional_charge";
  }

  const [result] = await db.query(
    `INSERT INTO adjustments (
      booking_id,
      amount,
      type,
      reason,
      created_at,
      updated_at
    ) VALUES (?, 0, ?, ?, NOW(), NOW())`,
    [bookingId, adjustmentType, reason]
  );

  return {
    id: result.insertId,
    bookingId,
    type: adjustmentType,
    status: "OPEN"
  };
}

/**
 * --------------------------------------------------
 * FIND DISPUTE BY ID
 * --------------------------------------------------
 */
async function findById(disputeId) {
  const [[row]] = await db.query(
    `SELECT
      a.id,
      a.booking_id,
      b.batch_id AS batchId,
      a.type,
      a.amount,
      a.reason,
      a.created_at,
      a.updated_at
     FROM adjustments a
     LEFT JOIN bookings b ON b.id = a.booking_id
     WHERE a.id = ?
     LIMIT 1`,
    [disputeId]
  );

  if (!row) return null;

  return {
    id: row.id,
    bookingId: row.booking_id,
    batchId: row.batchId,
    type: row.type,
    amount: row.amount,
    reason: row.reason,
    status: "OPEN",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * --------------------------------------------------
 * RESOLVE DISPUTE
 * --------------------------------------------------
 * NOTE:
 * - There is NO status column
 * - Resolution is appended to reason
 */
async function resolve(disputeId, resolutionNote) {
  if (!resolutionNote) return;

  await db.query(
    `UPDATE adjustments
     SET reason = CONCAT(COALESCE(reason, ''), '\n\nRESOLUTION: ', ?),
         updated_at = NOW()
     WHERE id = ?`,
    [resolutionNote, disputeId]
  );
}

/**
 * --------------------------------------------------
 * LIST DISPUTES
 * --------------------------------------------------
 */
async function list({ bookingId, batchId } = {}, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;

  let sql = `
    SELECT
      a.id,
      a.booking_id,
      b.batch_id AS batchId,
      a.type,
      a.amount,
      a.reason,
      a.created_at,
      a.updated_at
    FROM adjustments a
    LEFT JOIN bookings b ON b.id = a.booking_id
    WHERE 1=1
  `;

  const params = [];

  if (bookingId) {
    sql += ` AND a.booking_id = ?`;
    params.push(bookingId);
  }

  if (batchId) {
    sql += ` AND b.batch_id = ?`;
    params.push(batchId);
  }

  sql += `
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `;

  params.push(Number(limit), Number(offset));

  const [rows] = await db.query(sql, params);

  return rows.map(r => ({
    id: r.id,
    bookingId: r.booking_id,
    batchId: r.batchId,
    type: r.type,
    amount: r.amount,
    reason: r.reason,
    status: "OPEN",
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

module.exports = {
  create,
  findById,
  resolve,
  list
};
