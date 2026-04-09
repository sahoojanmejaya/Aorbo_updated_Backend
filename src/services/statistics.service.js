const db = require("../config/db");

/**
 * ============================================================
 * TBR (BATCH) STATISTICS – SCHEMA CORRECT
 * ============================================================
 *
 * SOURCES:
 * - bookings                → counts & status
 * - payment_logs            → money received
 * - cancellation_bookings   → refunds & deductions
 *
 * LIMITATIONS (BY DESIGN):
 * - No slots (not stored)
 * - No tax breakdown (not stored)
 * ============================================================
 */

async function getTBRStatistics(batchId) {
  /* ---------------- ACTIVE BOOKINGS ---------------- */
  const [[activeCount]] = await db.query(
    `SELECT COUNT(*) AS count
     FROM bookings
     WHERE batch_id = ?
       AND status = 'confirmed'`,
    [batchId]
  );

  /* ---------------- CANCELLED BOOKINGS ---------------- */
  const [[cancelledCount]] = await db.query(
    `SELECT COUNT(*) AS count
     FROM bookings
     WHERE batch_id = ?
       AND status = 'cancelled'`,
    [batchId]
  );

  /* ---------------- PAYMENTS (GROSS RECEIVED) ---------------- */
  const [[paymentTotals]] = await db.query(
    `SELECT
       COALESCE(SUM(pl.amount), 0) AS totalPaid
     FROM payment_logs pl
     JOIN bookings b ON b.id = pl.booking_id
     WHERE b.batch_id = ?
       AND pl.status = 'success'`,
    [batchId]
  );

  /* ---------------- REFUNDS & DEDUCTIONS ---------------- */
  const [[refundTotals]] = await db.query(
    `SELECT
      COALESCE(SUM(total_refundable_amount), 0) AS refundsIssued,
      COALESCE(SUM(deduction), 0) AS deductions
     FROM cancellation_bookings
     WHERE batch_id = ?`,
    [batchId]
  );

  /* ---------------- AGGREGATION ---------------- */
  const activeBookings = {
    count: activeCount.count,
    totalPaid: paymentTotals.totalPaid
  };

  const cancelledBookings = {
    count: cancelledCount.count,
    refundsIssued: refundTotals.refundsIssued,
    deductions: refundTotals.deductions
  };

  const overall = {
    totalGross: paymentTotals.totalPaid,
    netRefunds: refundTotals.refundsIssued,
    netRevenue: paymentTotals.totalPaid - refundTotals.refundsIssued
  };

  return {
    batchId,
    activeBookings,
    cancelledBookings,
    overall
  };
}

module.exports = {
  getTBRStatistics
};
