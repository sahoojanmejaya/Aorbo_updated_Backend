const db = require("../config/db");

/**
 * ============================================================
 * CANCELLATION REPOSITORY – MATCHES REAL SCHEMA
 * ============================================================
 *
 * TABLES USED:
 * - cancellation_bookings  (financial truth)
 * - cancellations          (audit/history)
 * - bookings               (status update only)
 *
 * ============================================================
 */

/**
 * --------------------------------------------------
 * CREATE CANCELLATION (TRANSACTIONAL)
 * --------------------------------------------------
 */
async function createCancellation(
  {
    bookingId,
    refundAmount,
    deductionAmount,
    vendorShare,
    reason,
    performedById,
    performedByName
  },
  conn = db
) {
  // 1️⃣ Fetch booking identifiers (ONLY real columns)
  const [[booking]] = await conn.query(
    `SELECT customer_id, trek_id, batch_id
     FROM bookings
     WHERE id = ?`,
    [bookingId]
  );

  if (!booking) {
    throw new Error("Booking not found");
  }

  // 2️⃣ Insert financial cancellation record
  // Delete existing to allow retries safely
  await conn.query("DELETE FROM cancellation_bookings WHERE booking_id = ?", [bookingId]);
  await conn.query("DELETE FROM cancellations WHERE booking_id = ?", [bookingId]);

  const finalVendorDeduc = Number(vendorShare) || 0;
  const finalAdminDeduc = Math.max(0, (Number(deductionAmount) || 0) - finalVendorDeduc);

  const [cbResult] = await conn.query(
    `INSERT INTO cancellation_bookings (
      booking_id,
      customer_id,
      trek_id,
      batch_id,
      total_refundable_amount,
      deduction,
      deduction_admin,
      deduction_vendor,
      status,
      reason,
      performed_by_id,
      performed_by_name,
      cancellation_date,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, NOW(), NOW(), NOW())`,
    [
      bookingId,
      booking.customer_id,
      booking.trek_id,
      booking.batch_id,
      refundAmount,
      deductionAmount,
      finalAdminDeduc,
      finalVendorDeduc,
      reason,
      performedById || 'ADM-SYSTEM',
      performedByName || 'System Admin'
    ]
  );

  // 3️⃣ Insert audit/history record
  await conn.query(
    `INSERT INTO cancellations (
      booking_id,
      reason,
      refund_amount,
      cancelled_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, NOW(), NOW(), NOW())`,
    [bookingId, reason, refundAmount]
  );

  // 4️⃣ Update booking status AND financials
  await conn.query(
    `UPDATE bookings
     SET status = 'cancelled',
         refund_amount = ?,
         deduction_amount = ?,
         updated_at = NOW()
     WHERE id = ?`,
    [refundAmount, deductionAmount, bookingId]
  );

  return {
    id: cbResult.insertId,
    bookingId,
    refundAmount,
    deductionAmount,
    status: "confirmed"
  };
}

/**
 * --------------------------------------------------
 * FIND CANCELLATION BY BOOKING ID
 * --------------------------------------------------
 */
async function findByBookingId(bookingId) {
  const [[row]] = await db.query(
    `SELECT
      id,
      booking_id AS bookingId,
      total_refundable_amount AS refundAmount,
      deduction AS deductionAmount,
      reason,
      status,
      cancellation_date AS cancellationDate,
      created_at AS createdAt
     FROM cancellation_bookings
     WHERE booking_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [bookingId]
  );

  return row || null;
}

/**
 * --------------------------------------------------
 * GET CANCELLATION HISTORY
 * --------------------------------------------------
 */
async function getCancellationHistory({ bookingId, batchId } = {}) {
  let sql = `
    SELECT
      cb.id,
      cb.booking_id AS bookingId,
      cb.batch_id AS batchId,
      cb.total_refundable_amount AS refundAmount,
      cb.deduction AS deductionAmount,
      cb.reason,
      cb.status,
      cb.cancellation_date AS cancellationDate,
      cb.created_at AS createdAt
    FROM cancellation_bookings cb
    WHERE 1=1
  `;

  const params = [];

  if (bookingId) {
    sql += ` AND cb.booking_id = ?`;
    params.push(bookingId);
  }

  if (batchId) {
    sql += ` AND cb.batch_id = ?`;
    params.push(batchId);
  }

  sql += ` ORDER BY cb.created_at DESC`;

  const [rows] = await db.query(sql, params);
  return rows;
}

module.exports = {
  createCancellation,
  findByBookingId,
  getCancellationHistory
};
