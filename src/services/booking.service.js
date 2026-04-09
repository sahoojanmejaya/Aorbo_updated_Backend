const bookingRepo = require("../repositories/booking.repo");
const cancellationRepo = require("../repositories/cancellation.repo");
const auditRepo = require("../repositories/audit.repo");
const tbrRepo = require("../repositories/tbr.repo");
const bookingPaymentRepo = require("../repositories/bookingPayment.repo");
const db = require("../config/db");
const round = require("../utils/rounding");
const FinanceConfig = require("../config/finance.config");

/**
 * --------------------------------------------------
 * VENDOR MARK COLLECTED (Offline Payment)
 * --------------------------------------------------
 */
async function markCollected(bookingId, payload, actor) {
  const {
    amount,
    method, // 'cash' | 'UPI'
    refNo,
    attachmentUrl,
    notes,
    idempotencyToken
  } = payload;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const booking = await bookingRepo.findById(bookingId);
    if (!booking) {
      throw { statusCode: 404, message: "Booking not found" };
    }

    // Calculate balance
    // Note: booking.totalAmount might be missing if repo doesn't return it, ensure it does
    const totalAmount = booking.totalAmount || 0;
    const paidAmount = booking.paidAmount || 0;
    const balance = totalAmount - paidAmount;

    // Logic: Accepted amount cannot exceed balance (unless we want to track overpayment)
    const claimedAmount = parseFloat(amount);
    const acceptedAmount = Math.min(claimedAmount, balance);
    const isOverpayment = claimedAmount > balance;

    const paymentId = await bookingPaymentRepo.create({
      booking_id: bookingId,
      payment_type: 'balance_offline',
      amount: claimedAmount,
      claimed_amount: claimedAmount,
      accepted_amount: acceptedAmount,
      method,
      ref_no: refNo,
      attachment_url: attachmentUrl,
      vendor_user_id: actor?.id,
      marked_at: new Date(),
      evidence_status: 'pending'
    });

    // Update booking status if fully paid
    let newStatus = booking.paymentStatus;
    let newPaidAmount = paidAmount + acceptedAmount;

    // Use a small tolerance for float comparison
    if (newPaidAmount >= totalAmount - 0.1) {
      // Update booking as completed
      // We use direct query because bookingRepo might not have updateStatus exposed yet or for efficiency
      await conn.query('UPDATE bookings SET payment_status = ?, paidAmount = ? WHERE id = ?', ['completed', newPaidAmount, bookingId]);
    } else {
      await conn.query('UPDATE bookings SET paidAmount = ? WHERE id = ?', [newPaidAmount, bookingId]);
    }

    // Create Audit Log
    await conn.query(`
      INSERT INTO booking_audit_log (
        booking_id, action_type, actor_type, actor_id, metadata, idempotency_token, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [
      bookingId,
      'payment_marked',
      'vendor',
      actor?.id,
      JSON.stringify({
        claimed: claimedAmount,
        accepted: acceptedAmount,
        method,
        isOverpayment
      }),
      idempotencyToken
    ]);

    if (isOverpayment) {
      // Log overpayment record
      await conn.query(`
         INSERT INTO overpayment_records (
           booking_id, expected_amount, received_amount, overpay_amount, payment_id, created_at
         ) VALUES (?, ?, ?, ?, ?, NOW())
       `, [
        bookingId, balance, claimedAmount, (claimedAmount - balance), paymentId
      ]);
    }

    await conn.commit();
    return { success: true, paymentId, acceptedAmount, isOverpayment };

  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * --------------------------------------------------
 * CREATE BOOKING (Backend Financial Computation)
 * --------------------------------------------------
 */
async function createBooking(payload) {
  const {
    tbrId,
    slots,
    travellerName,
    travellerDetails,
    couponDetails = null,
    policyType = "STANDARD",
    paidAmount = null
  } = payload;

  if (!tbrId || !slots || !travellerName) {
    throw {
      statusCode: 400,
      message: "Validation failed",
      errors: { fields: "tbrId, slots and travellerName are required" }
    };
  }

  const tbr = await tbrRepo.findById(tbrId);
  if (!tbr) {
    throw {
      statusCode: 404,
      message: "Resource not found",
      errors: { tbrId: "TBR not found" }
    };
  }

  /* ---------------- FINANCIAL COMPUTATION ---------------- */
  const finalBaseFare = slots * tbr.discountedPrice;
  const gst5 = round(finalBaseFare * FinanceConfig.GST_RATE_BASIC);
  const comm10 = round(finalBaseFare * FinanceConfig.COMMISSION_RATE);
  const getComm18 = round(comm10 * FinanceConfig.GST_RATE_COMM);
  const pf = FinanceConfig.PLATFORM_FEE;
  const getPF5 = round(pf * FinanceConfig.GST_RATE_PF);
  const tcs1 = round(finalBaseFare * FinanceConfig.TCS_RATE);
  const tds1 = round(finalBaseFare * FinanceConfig.TDS_RATE);
  const taxes = gst5 + getComm18 + getPF5 + tcs1 + tds1;
  const totalAmount = finalBaseFare + taxes + comm10 + pf;

  /* ---------------- PAYMENT LOGIC ---------------- */
  let finalPaidAmount;
  let pendingAmount;
  let paymentStatus;

  if (policyType && policyType.toUpperCase().includes("STANDARD")) {
    finalPaidAmount = totalAmount;
    pendingAmount = 0;
    paymentStatus = "PAID";
  } else if (policyType && policyType.toUpperCase().includes("FLEXIBLE")) {
    if (paidAmount === null || paidAmount <= 0) {
      throw {
        statusCode: 400,
        message: "Validation failed",
        errors: { paidAmount: "paidAmount required for FLEXIBLE policy" }
      };
    }
    if (paidAmount > totalAmount) {
      throw {
        statusCode: 400,
        message: "Validation failed",
        errors: { paidAmount: "paidAmount exceeds total amount" }
      };
    }
    finalPaidAmount = paidAmount;
    pendingAmount = totalAmount - paidAmount;
    paymentStatus = pendingAmount === 0 ? "PAID" : "PARTIAL";
  } else {
    throw {
      statusCode: 400,
      message: "Validation failed",
      errors: { policyType: "Invalid policy type" }
    };
  }

  const vendorShare = finalBaseFare - comm10;

  const booking = await bookingRepo.create({
    tbrId,
    slots,
    travellerName,
    travellerDetails,
    couponDetails,
    finalBaseFare,
    gst5,
    pf,
    comm10,
    getComm18,
    getPF5,
    tcs1,
    tds1,
    taxes,
    totalAmount,
    paidAmount: finalPaidAmount,
    pendingAmount,
    paymentStatus,
    policyType,
    totalPaid: totalAmount,
    vendorShare
  });

  return booking;
}

async function getPendingBalances(query) {
  const rows = await bookingRepo.getPendingBalances(query);
  return {
    count: rows.length,
    bookings: rows
  };
}

async function getAllBookings(query) {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 50;
  const offset = (page - 1) * limit;
  const search = query.search || '';
  return await bookingRepo.findAll({ limit, offset, search });
}

async function getBookingById(bookingId) {
  const booking = await bookingRepo.findById(bookingId);
  if (!booking) {
    throw {
      statusCode: 404,
      message: "Resource not found",
      errors: { bookingId: "Booking not found" }
    };
  }
  return booking;
}

const cancellationPreviewService = require("./cancellationPreview.service");

// ... (keep existing imports if needed, but remove policy imports if checking confirms they are unused)

async function cancelBooking(tbrId, bookingId, payload) {
  const {
    refundAmount,
    deductionAmount,
    reason,
    mode,
    vendorShare,
    performerId,
    performerName
  } = payload;

  if (!reason || !mode) {
    throw {
      statusCode: 400,
      message: "Validation failed",
      errors: { reason: "Reason and mode are required" }
    };
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const booking = await bookingRepo.findById(bookingId);
    if (!booking) throw { statusCode: 404, message: "Booking not found" };

    if (booking.status && booking.status.toLowerCase() === "cancelled") {
      throw { statusCode: 409, message: "Booking already cancelled" };
    }

    const tbr = await tbrRepo.findById(tbrId);
    let calcRefund = 0;
    let calcDeduction = 0;
    let cxlSlab = "MANUAL";

    if (mode === "MANUAL") {
      if (typeof refundAmount === 'undefined') throw { statusCode: 400, message: "Refund Amount required for Manual mode" };
      calcRefund = Number(refundAmount);

      if (typeof deductionAmount !== 'undefined') {
        calcDeduction = Number(deductionAmount);
      } else {
        // Fallback: use what they actually paid
        const paid = Number(booking.paid_amount) || Number(booking.advance_amount) || Number(booking.totalPaid) || 0;
        calcDeduction = paid - calcRefund;
      }
    } else {
      // Use Service for Calculation
      // Resolve numeric Batch ID
      const batchId = tbr.id;
      const preview = await cancellationPreviewService.previewCancellation(batchId, bookingId);

      calcRefund = preview.totalRefundAmount;
      calcDeduction = preview.totalDeductionAmount;
      cxlSlab = preview.slabApplied || preview.deductionPercentage + "%";
    }

    // ... remainder of cancelBooking ...
    const cxlId = `CXL-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 1000)}`;

    // 1️⃣ Perform full transactional cancellation using cancellationRepo
    const result = await cancellationRepo.createCancellation(
      {
        bookingId,
        refundAmount: calcRefund,
        deductionAmount: calcDeduction,
        vendorShare: vendorShare,
        reason,
        cxlId,
        performedById: performerId,
        performedByName: performerName
      },
      conn
    );

    await auditRepo.create(
      {
        performerId,
        performerName,
        tbrId,
        tbrName: tbr.trekName,
        action: "BOOKING_CANCELLED",
        reason: `${reason} | Slab: ${cxlSlab}`,
        bookingId
      },
      conn
    );

    await conn.commit();

    return {
      booking: {
        id: bookingId,
        status: "cancelled",
        cxlId,
        cxlReason: reason,
        refundAmount: calcRefund,
        deductionAmount: calcDeduction,
        slab: cxlSlab
      }
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function previewCancellation(tbrId, bookingId) {
  const tbr = await tbrRepo.findById(tbrId);
  if (!tbr) throw { statusCode: 404, message: "TBR not found" };

  // Helper expects numeric Batch ID
  const batchId = tbr.id;

  const result = await cancellationPreviewService.previewCancellation(batchId, bookingId);

  return {
    refundAmount: result.totalRefundAmount,
    deductionAmount: result.totalDeductionAmount,
    slab: result.slabApplied,
    breakdown: {
      gst: 0, // Service can be enhanced to return these if needed
      smr: 0,
      policy: result.baseDeduction // showing policy deduction
    },
    // Pass through full result for debug if needed
    details: result
  };
}

async function getActiveBookings(query) {
  return await bookingRepo.findActiveBookings({
    startDate: query.startDate,
    endDate: query.endDate,
    vendorId: query.vendorId
  });
}

async function getBookingSummary(query) {
  const stats = await bookingRepo.getSummaryStats({
    startDate: query.startDate,
    endDate: query.endDate,
    vendorId: query.vendorId
  });

  return { active: { totals: stats || { totalGst: 0, totalPlatformFeeGst: 0, totalCommissionGst: 0, totalTcs: 0, totalTds: 0, totalLiability: 0 } } };
}

module.exports = {
  markCollected,
  createBooking,
  getPendingBalances,
  getAllBookings,
  getBookingById,
  cancelBooking,
  previewCancellation,
  getActiveBookings,
  getBookingSummary
};
