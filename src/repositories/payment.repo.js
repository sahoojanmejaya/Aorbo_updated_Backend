const db = require("../config/db");

/**
 * ============================================================
 * PAYMENTS REPOSITORY – MATCHES REAL SCHEMA
 * ============================================================
 *
 * TABLES USED:
 * - payment_logs     (booking-linked, online payments)
 * - manual_payments  (user/vendor-linked, offline payments)
 *
 * IMPORTANT:
 * - This repo DOES NOT update bookings
 * - It only records money movement
 * ============================================================
 */

/**
 * --------------------------------------------------
 * CREATE ONLINE (APP) PAYMENT
 * --------------------------------------------------
 */
async function createAppPaymentLog(
  { bookingId, transactionId, amount, paymentMethod = "online", status = "success" },
  conn = db
) {
  const [result] = await conn.query(
    `INSERT INTO payment_logs (
      booking_id,
      amount,
      payment_method,
      transaction_id,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [bookingId, amount, paymentMethod, transactionId, status]
  );

  return {
    id: result.insertId,
    bookingId,
    transactionId,
    amount,
    status
  };
}

/**
 * --------------------------------------------------
 * CREATE OFFLINE / MANUAL PAYMENT
 * --------------------------------------------------
 * NOTE:
 * - manual_payments is NOT booking-linked
 * - It is a user/vendor ledger entry
 */
async function createManualPayment(
  { userId, amount, description },
  conn = db
) {
  const [result] = await conn.query(
    `INSERT INTO manual_payments (
      user_id,
      amount,
      payment_date,
      description,
      created_at,
      updated_at
    ) VALUES (?, ?, NOW(), ?, NOW(), NOW())`,
    [userId, amount, description || "Manual payment"]
  );

  return {
    id: result.insertId,
    userId,
    amount
  };
}

/**
 * --------------------------------------------------
 * GET PAYMENT HISTORY FOR A BOOKING
 * --------------------------------------------------
 */
async function getPaymentHistory(bookingId) {
  const [rows] = await db.query(
    `SELECT
      id,
      booking_id AS bookingId,
      transaction_id AS transactionId,
      amount,
      payment_method AS paymentMethod,
      status,
      created_at AS createdAt
     FROM payment_logs
     WHERE booking_id = ?
     ORDER BY created_at DESC`,
    [bookingId]
  );

  return rows;
}

/**
 * --------------------------------------------------
 * GET MANUAL PAYMENTS FOR USER / VENDOR
 * --------------------------------------------------
 */
async function getManualPaymentsByUser(userId) {
  const [rows] = await db.query(
    `SELECT
      id,
      amount,
      description,
      payment_date AS paymentDate,
      created_at AS createdAt
     FROM manual_payments
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId]
  );

  return rows;
}

module.exports = {
  createAppPaymentLog,
  createManualPayment,
  getPaymentHistory,
  getManualPaymentsByUser
};
