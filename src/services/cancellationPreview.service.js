const db = require("../config/db");
const standardPolicy = require("../policies/standard.policy");
const flexiblePolicy = require("../policies/flexible.policy");

/**
 * ============================================================
 * CANCELLATION PREVIEW SERVICE
 * ============================================================
 */

async function previewCancellation(batchId, bookingId) {
  /* ---------------- VALIDATE BOOKING ---------------- */
  // Fetch detailed booking info including Advance, Fees, Payments
  const [[booking]] = await db.query(
    `SELECT b.id, b.status, b.total_amount, b.trek_id, 
            b.total_basic_cost, b.platform_fees, b.gst_amount, 
            b.advance_amount, b.cancellation_policy_type,
            b.payment_status, b.free_cancellation_amount, b.insurance_amount
     FROM bookings b
     WHERE b.id = ? AND b.batch_id = ?`,
    [bookingId, batchId]
  );

  if (!booking) {
    throw {
      statusCode: 404,
      message: "Booking not found",
      errors: { bookingId }
    };
  }

  if (booking.status === "cancelled") {
    throw {
      statusCode: 400,
      message: "Booking already cancelled"
    };
  }

  /* ---------------- FETCH BATCH & TREK POLICY ---------------- */
  // We prefer the policy locked in the booking (cancellation_policy_type)
  // If not present, fallback to Trek's policy
  let policyType = booking.cancellation_policy_type;

  const [[batch]] = await db.query(
    `SELECT start_date FROM batches WHERE id = ?`,
    [batchId]
  );

  if (!batch) {
    throw { statusCode: 404, message: "Batch not found" };
  }

  // If policy type missing in booking, fetch from Trek > Policies fallback
  if (!policyType) {
    const [[trekPolicy]] = await db.query(
      `SELECT cp.title 
           FROM treks t
           LEFT JOIN cancellation_policies cp ON cp.id = t.cancellation_policy_id
           WHERE t.id = ?`,
      [booking.trek_id]
    );
    const title = (trekPolicy?.title || "STANDARD").toUpperCase();
    policyType = title.includes("FLEXIBLE") ? "FLEXIBLE" : "STANDARD";
  }

  /* ---------------- CALCULATE DAYS TO DEPARTURE ---------------- */
  const now = new Date(); // Current Server Time (UTC)
  const departure = new Date(batch.start_date);

  // Parameters for policy engine
  const params = {
    trekPrice: Number(booking.total_basic_cost) || Number(booking.total_amount), // Use Base Cost
    advanceAmount: Number(booking.advance_amount) || 0,
    trekStart: departure,
    cancellationTime: now
  };

  let result;
  // STRICT POLICY SELECTION
  if (String(policyType).toUpperCase() === "FLEXIBLE") {
    result = flexiblePolicy.calculateFlexibleRefund(params);
  } else {
    result = standardPolicy.calculateStandardRefund(params);
  }

  /* ---------------- NON-REFUNDABLE COMPONENTS ---------------- */

  // Platform Fee is always Non-Refundable
  const platformFee = Number(booking.platform_fees) || 0;

  // GST Refund Logic:
  // User: "GST refunded if trek not provided" (unless <24h / 100% deduction where everything is consumed?)
  // Standard Policy (>24h): GST is refunded.
  // Standard Policy (<24h): 100% Deduction -> Likely means GST also retained/consumed.
  // Flexible Policy (>24h): Advance Retained, GST Refunded? 
  // Let's assume GST is ALWAYS Refundable if Deduction < 100%.
  // If Deduction = 100%, Refund = 0 (Total Loss).

  const gstAmount = Number(booking.gst_amount) || 0;

  // Add-ons (Insurance, FreeCancel) - Non-Refundable usually
  const insuranceFee = Number(booking.insurance_amount) || 0;
  const freeCancelFee = Number(booking.free_cancellation_amount) || 0;

  // FREE CANCELLATION OVERRIDE
  if (freeCancelFee > 0) {
    result.deductionAmount = 0;
    result.deductionPercent = 0;
    result.slab = "Free Cancellation Applied";
    result.message = "Refund processed with Free Cancellation Benefit";
  }

  const totalPaid = Number(booking.total_amount); // Assuming total_amount is what was paid
  // Wait, total_amount might be Total Payable. We need 'Effective Paid'.
  // But for Standard (Full Pay), Total = Paid.
  // For Flexible (Advance Only), Paid = Advance + PF + GST + Addons (approx).
  // Actually, 'total_amount' in DB usually stores the Invoice Total.
  // We should check 'advance_amount' vs 'total_amount'.

  let finalRefund = 0;
  let finalDeduction = 0;

  const baseDeduction = result.deductionAmount;
  // baseDeduction is pure penalty on Base Fare (or Advance).

  if ((result.deductionPercent === 100 || baseDeduction >= params.trekPrice) && policyType !== 'FLEXIBLE') {
    // 100% Loss (Standard Policy mostly)
    finalRefund = 0;
    finalDeduction = totalPaid;
  } else {
    // Partial Loss OR Flexible (where GST is preserved)
    // Determine 'amount actually paid'
    /* ---------------- FETCH ADDITIONAL PAYMENTS ---------------- */
    // Sum up all verified payments from booking_payments (excluding advance which is already in advance_amount)
    const [[paymentStats]] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total_additional
       FROM booking_payments
       WHERE booking_id = ? 
       AND evidence_status = 'verified'
       AND payment_type != 'advance'`,
      [bookingId]
    );

    const additionalPaid = Number(paymentStats?.total_additional) || 0;

    // Calculate Effective Paid Amount
    let amountActuallyPaid = 0;

    // If marked fully paid, we might trust total_amount, but let's be consistent and sum everything we know.
    // If it's a "Standard" booking created with full payment, 'advance_amount' might hold the full value?
    // Or 'total_amount'. In our seed, 'advance_amount' = 1000, 'total' = 5000.
    // Yet payment_status = 'paid'. This implies the difference was settled or 'advance' field is misused.
    // Let's assume: If status='paid', use total_amount. If status='partial', use advance + additional.
    // If marked fully paid, we might trust total_amount, but let's be consistent and sum everything we know.
    const payStatus = (booking.payment_status || '').toLowerCase();
    const isFullPaid = payStatus === 'paid' || payStatus === 'full_paid' || payStatus === 'completed';

    if (isFullPaid) {
      amountActuallyPaid = Number(booking.total_amount);
    } else {
      amountActuallyPaid = (Number(booking.advance_amount) || 0) + additionalPaid;
    }

    const nonRefundables = platformFee + insuranceFee + freeCancelFee;

    // Logic Refinement:
    // Deduction = Policy Penalty (on Base) + Non-Refundables (PF/Ins/Addons).
    // Refund = Paid - Deduction.
    // GST Handling:
    // If we deduct 100% of Base, does GST get refunded?
    // Case 1: Standard 100% (<24h). User forfeits everything ideally.
    // Case 2: Standard 20%. User gets back 80% Base + 100% GST (usually).
    // So, Deduction should ONLY consist of the Penalty + NonRefundables.
    // GST should naturally remain in the "Refund" portion.

    let effectiveDeduction = baseDeduction + nonRefundables;

    // Safety check: Cannot deduct more than what was paid.
    if (effectiveDeduction > amountActuallyPaid) {
      effectiveDeduction = amountActuallyPaid;
    }

    // Special Case: 100% Cancellation Slab (e.g. <24h standard)
    // If slab is 100%, we often retain GST too?
    // If policy says "100% of Trip Cost", and Trip Cost = Base, then GST is returned?
    // Most operators retain GST on 100% cancellation.
    // Let's assume if deductionPercent === 100, we retain available GST too.
    if (result.deductionPercent === 100) {
      // Try to retain everything.
      effectiveDeduction = amountActuallyPaid;
    }

    finalRefund = amountActuallyPaid - effectiveDeduction;
    finalDeduction = effectiveDeduction;

    // Remove the redundant if-else block below and use these values directly.


    // (Logic moved up and variable redeclarations fixed)

    // Ensure 2 decimal precision
    finalRefund = Number(Math.max(0, finalRefund).toFixed(2));
    finalDeduction = Number(Math.max(0, finalDeduction).toFixed(2));
  }

  // Generate breakdown
  const hoursLeft = (departure.getTime() - now.getTime()) / (1000 * 60 * 60);

  return {
    bookingId,
    batchId,
    timestamp: now,
    daysToDeparture: (hoursLeft / 24).toFixed(1),
    hoursToDeparture: hoursLeft.toFixed(1),
    policyApplied: policyType,
    slabApplied: result.slab,
    deductionPercentage: result.deductionPercent,

    // Monetary
    baseFare: params.trekPrice,
    baseDeduction: result.deductionAmount,
    baseRefund: result.refundAmount,

    // Final
    totalRefundAmount: finalRefund,
    totalDeductionAmount: finalDeduction,

    message: result.message,
    refundable: finalRefund > 0
  };
}

module.exports = {
  previewCancellation
};
