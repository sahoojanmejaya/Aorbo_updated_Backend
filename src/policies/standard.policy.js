/**
 * Standard Cancellation Policy Logic
 * Match user provided "Standard Cancellation Policy — Summary"
 * 
 * Rules:
 * - >= 72h: 20%
 * - 48h - 72h: 50%
 * - 24h - 48h: 70%
 * - < 24h: 100%
 * - After start: 100%
 * 
 * Boundary: "Exactly 72h -> 50%". So (> 72h is 20%).
 */

function roundHalfUp(value) {
  return Number((Math.round(value * 100) / 100).toFixed(2));
}

function calculateStandardRefund(params) {
  const {
    trekPrice,
    trekStart,
    cancellationTime,
    // advanceAmount // Not strictly used in Standard % calculation, but passed for consistency
  } = params;

  const msDiff = trekStart.getTime() - cancellationTime.getTime();
  const hoursLeft = msDiff / (1000 * 60 * 60);

  let deductionPercent = 100;
  let slab = "100%";

  if (msDiff <= 0) {
    deductionPercent = 100;
    slab = "After Start";
  } else if (hoursLeft > 72) {
    deductionPercent = 20;
    slab = "20% (>72h)";
  } else if (hoursLeft > 48) {
    deductionPercent = 50;
    slab = "50% (48h-72h)";
  } else if (hoursLeft > 24) {
    deductionPercent = 70;
    slab = "70% (24h-48h)";
  } else {
    deductionPercent = 100;
    slab = "100% (<24h)";
  }

  const deductionAmount = roundHalfUp(trekPrice * (deductionPercent / 100));
  const refundAmount = roundHalfUp(trekPrice - deductionAmount);

  return {
    deductionPercent,
    slab,
    deductionAmount,
    refundAmount: Math.max(0, refundAmount),
    message: deductionPercent === 100 ? "No refund as per policy" : "Refund processed as per policy"
  };
}

module.exports = { calculateStandardRefund, roundHalfUp };
