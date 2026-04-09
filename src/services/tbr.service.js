const tbrRepo = require("../repositories/tbr.repo");
const bookingRepo = require("../repositories/booking.repo");
const statisticsService = require("./statistics.service");
const { getPagination, buildPaginationMeta } = require("../utils/pagination");
const bookingService = require("./booking.service");
const db = require("../config/db");

/**
 * --------------------------------------------------
 * LIST TBRs (Batches)
 * --------------------------------------------------
 */
async function getTBRList(query = {}) {
  const { page, limit, offset } = getPagination(query.page, query.limit);

  const filters = {};
  if (query.tbrIdSearch) filters.tbrIdSearch = query.tbrIdSearch;
  if (query.startDate) filters.startDate = query.startDate;
  if (query.endDate) filters.endDate = query.endDate;

  const { rows, total } = await tbrRepo.findAll(filters, limit, offset);

  return {
    tbrs: rows,
    pagination: buildPaginationMeta(page, limit, total)
  };
}

/**
 * --------------------------------------------------
 * GET SINGLE TBR WITH BOOKINGS
 * --------------------------------------------------
 */
async function getTBRWithBookings(tbrId) {
  if (!tbrId) return null;

  const tbr = await tbrRepo.findById(tbrId);
  if (!tbr) return null;

  // Use the numeric ID from the TBR object, not the string tbrId
  // tbr.id is the internal numeric ID, tbrId is the string like "TBR79RF30V"
  const bookings = await bookingRepo.findByBatchId(tbr.id);
  tbr.bookings = bookings || [];

  return tbr;
}

/**
 * --------------------------------------------------
 * GET TBR STATISTICS
 * --------------------------------------------------
 */
async function getTBRStatistics(tbrId) {
  if (!tbrId) return null;

  const exists = await tbrRepo.findById(tbrId);
  if (!exists) return null;

  return statisticsService.getTBRStatistics(tbrId);
}

/**
 * --------------------------------------------------
 * CANCEL ENTIRE BATCH (TBR)
 * --------------------------------------------------
 */
async function cancelBatch(tbrId, reason, adminUser) {
  const tbr = await tbrRepo.findById(tbrId);
  if (!tbr) throw { statusCode: 404, message: "TBR not found" };

  const batchId = tbr.id;
  const bookings = await bookingRepo.findByBatchId(batchId);

  // Determine Scenario: Upcoming vs Ongoing
  const now = new Date();
  const departure = new Date(tbr.departureTime);
  const isUpcoming = now < departure;

  console.log(`Cancelling Batch ${batchId} (${tbr.tbrId}). Scenario: ${isUpcoming ? 'UPCOMING' : 'ONGOING'}`);

  for (const b of bookings) {
    // Skip if already cancelled
    if (b.status && b.status.toLowerCase() === 'cancelled') continue;

    let refund = 0;
    let deduction = 0;

    const val = (v) => Number(v) || 0;
    // Use realizedTotalPaid (full collected) or appPaidTotal (app held) or totalPaid (fallback)
    const paid = val(b.realizedTotalPaid || b.appPaidTotal || b.totalPaid);

    if (isUpcoming) {
      // Scenario 1: Upcoming (Before Departure)
      // Platform Retains: PF + GST(PF)
      // Refund = Paid - Retained
      const idealDeduction = val(b.pf) + val(b.getPF5);
      refund = Math.max(0, paid - idealDeduction);
      deduction = paid - refund;
    } else {
      // Scenario 2: Ongoing (After Departure)
      // Platform Retains: Comm + GST(Comm) + PF + GST(PF) + TCS + TDS
      // Vendor Share: 0 (Strict)
      const idealDeduction = val(b.comm10) + val(b.getComm18) + val(b.pf) + val(b.getPF5) + val(b.tcs1) + val(b.tds1);
      refund = Math.max(0, paid - idealDeduction);
      deduction = paid - refund;
    }

    // Perform Cancellation via Service
    // Pass tbr.tbrId or numeric tbr.id as fallback to ensure repo finds it
    await bookingService.cancelBooking(tbr.tbrId || tbr.id, b.id, {
      mode: 'MANUAL',
      reason: `Batch Cancel: ${reason}`,
      refundAmount: Math.round(refund),
      deductionAmount: Math.round(deduction),
      vendorShare: 0,
      performerId: adminUser.id,
      performerName: adminUser.name
    });
  }

  // Update Batch Status
  await db.query("UPDATE batches SET status = 'cancelled' WHERE id = ?", [batchId]);

  return { success: true, message: "Batch cancelled and financials processed." };
}

module.exports = {
  getTBRList,
  getTBRWithBookings,
  getTBRStatistics,
  cancelBatch
};
