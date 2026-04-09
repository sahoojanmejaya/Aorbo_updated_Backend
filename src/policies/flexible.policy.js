/**
 * Flexible Cancellation Policy Logic
 * Based on 'BASE-*' Study Cases from User
 * 
 * Rules:
 * - Cancel > 24h: Deduction = Advance Amount (User gets refund of rest)
 * - Cancel <= 24h: Deduction = 100% of Base Fare (No refund of base)
 * - After start: 100% Deduction
 * 
 * Note: GST/Platform Fee handled in Service
 */

function roundHalfUp(value) {
  return Number((Math.round(value * 100) / 100).toFixed(2));
}

function calculateFlexibleRefund(params) {
  const {
    trekPrice,          // Base Fare
    advanceAmount,      // The Advance Amount defined in booking (e.g. 999)
    trekStart,
    cancellationTime,
  } = params;

  const msDiff = trekStart.getTime() - cancellationTime.getTime();
  const hoursLeft = msDiff / (1000 * 60 * 60);

  let deductionPercent = 0;
  let slab = "";
  let deductionAmount = 0;

  if (msDiff <= 0) {
    deductionPercent = 100;
    slab = "After Start";
    deductionAmount = trekPrice;
  } else if (hoursLeft > 24) {
    // > 24h: Lose Advance Only (as per BASE-001, BASE-006)
    deductionPercent = 0; // Not a % slab
    slab = "Advance Retained (>24h)";
    deductionAmount = advanceAmount || 0;
  } else {
    // <= 24h: 100% Deduction (as per BASE-004, BASE-012)
    deductionPercent = 100;
    slab = "100% (<=24h)";
    deductionAmount = trekPrice;
  }

  const refundAmount = roundHalfUp(trekPrice - deductionAmount);

  return {
    deductionPercent: deductionPercent,
    slab,
    deductionAmount,
    refundAmount: Math.max(0, refundAmount),
    message: deductionPercent === 100 ? "No refund as per policy" : "Refund processed as per policy"
  };
}

module.exports = { calculateFlexibleRefund, roundHalfUp };
