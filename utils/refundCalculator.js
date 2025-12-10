/**
 * Refund Calculator Utility
 * Implements flexible and standard cancellation policies as per client requirements
 */

/**
 * Round half up function for precise calculations
 * @param {number} value - Value to round
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {number} Rounded value
 */
function roundHalfUp(value, decimals = 2) {
    const factor = Math.pow(10, decimals);
    return Math.floor(value * factor + 0.5) / factor;
}

/**
 * Calculate Flexible Policy Refund
 * @param {Object} params - Calculation parameters
 * @param {number} params.bookingAmount - Total trek price
 * @param {number} params.advanceAmount - Amount paid as advance
 * @param {string} params.paymentStatus - "advance_only" or "full_paid"
 * @param {number} params.timeToDeparture - Time left until trek starts (in hours)
 * @param {Object} params.policySettings - Policy settings from database
 * @returns {Object} Refund calculation result
 */
function calculateFlexibleRefund({ bookingAmount, advanceAmount, paymentStatus, timeToDeparture, policySettings = null }) {
    // Get policy settings or use defaults
    const advanceNonRefundable = policySettings?.flexible_advance_non_refundable ?? true;
    const fullPayment24hDeduction = policySettings?.flexible_full_payment_24h_deduction ?? 100;

    // Case 1: Only advance paid
    if (paymentStatus === "advance_only") {
        if (advanceNonRefundable) {
            return {
                deduction: roundHalfUp(advanceAmount),
                refund: 0,
                rule: "Advance payment non-refundable",
                policy_type: "flexible",
                payment_status: "advance_only"
            };
        } else {
            return {
                deduction: 0,
                refund: roundHalfUp(advanceAmount),
                rule: "Advance payment fully refundable",
                policy_type: "flexible",
                payment_status: "advance_only"
            };
        }
    }

    // Case 2: Full payment made
    if (paymentStatus === "full_paid") {
        if (timeToDeparture > 24) {
            // More than 24h before trek: Advance hold, refund rest
            const deduction = advanceNonRefundable ? roundHalfUp(advanceAmount) : 0;
            const refund = roundHalfUp(bookingAmount - deduction);
            
            return {
                deduction: deduction,
                refund: refund,
                rule: advanceNonRefundable ? "Advance hold, refund rest" : "Full refund (more than 24h)",
                policy_type: "flexible",
                payment_status: "full_paid",
                time_remaining_hours: timeToDeparture
            };
        } else {
            // Within 24h of trek: Configurable deduction
            const deductionAmount = (bookingAmount * fullPayment24hDeduction) / 100;
            const refund = roundHalfUp(bookingAmount - deductionAmount);
            
            return {
                deduction: roundHalfUp(deductionAmount),
                refund: refund,
                rule: `${fullPayment24hDeduction}% deduction (within 24h)`,
                policy_type: "flexible",
                payment_status: "full_paid",
                time_remaining_hours: timeToDeparture
            };
        }
    }

    // Default case
    return {
        deduction: roundHalfUp(bookingAmount),
        refund: 0,
        rule: "Invalid payment status",
        policy_type: "flexible",
        error: "Invalid payment status provided"
    };
}

/**
 * Calculate Standard Policy Refund
 * @param {Object} params - Calculation parameters
 * @param {number} params.trekPrice - Trek price (exclude GST & platform fees)
 * @param {Date} params.trekStartDatetime - Trek start datetime (UTC)
 * @param {Date} params.cancellationTime - Cancellation request time (UTC)
 * @param {string} params.bookingStatus - Current booking status
 * @param {Object} params.policySettings - Policy settings from database
 * @returns {Object} Refund calculation result
 */
function calculateStandardRefund({ trekPrice, trekStartDatetime, cancellationTime, bookingStatus, policySettings = null }) {
    // Pre-check: Idempotency Check
    if (bookingStatus === "cancelled") {
        return {
            error: "Already cancelled",
            status: 409,
            message: "Booking is already cancelled"
        };
    }

    // Calculate time difference in hours
    const timeDifferenceMs = trekStartDatetime.getTime() - cancellationTime.getTime();
    const timeDifferenceHours = timeDifferenceMs / (1000 * 60 * 60);

    console.log("🔍 Standard Policy Time calculation:", {
        cancellationTime: cancellationTime.toISOString(),
        trekStartDatetime: trekStartDatetime.toISOString(),
        timeDifferenceHours: timeDifferenceHours
    });

    // Get policy settings or use defaults
    const settings72hPlus = policySettings?.standard_72h_plus_deduction ?? 20;
    const settings48_72h = policySettings?.standard_48_72h_deduction ?? 50;
    const settings24_48h = policySettings?.standard_24_48h_deduction ?? 70;
    const settingsUnder24h = policySettings?.standard_under_24h_deduction ?? 100;

    // Determine deduction percentage based on time slabs
    let deductionPercent;
    let slabInfo;

    if (timeDifferenceHours > 72) {
        deductionPercent = settings72hPlus;
        slabInfo = "≥72h before trek";
    } else if (timeDifferenceHours > 48) {
        deductionPercent = settings48_72h;
        slabInfo = "48-72h before trek";
    } else if (timeDifferenceHours > 24) {
        deductionPercent = settings24_48h;
        slabInfo = "24-48h before trek";
    } else if (timeDifferenceHours > 0) {
        deductionPercent = settingsUnder24h;
        slabInfo = "<24h before trek";
    } else {
        // After trek start
        deductionPercent = settingsUnder24h;
        slabInfo = "After trek start";
    }

    // Calculate deduction and refund amounts
    let deductionAmount = roundHalfUp((trekPrice * deductionPercent) / 100);
    let refundAmount = roundHalfUp(trekPrice - deductionAmount);
    let message = "Refund processed as per policy.";

    // Override if after trek start
    if (timeDifferenceHours <= 0) {
        deductionAmount = roundHalfUp(trekPrice);
        refundAmount = 0;
        message = "Refunds not possible after departure.";
    }

    return {
        deduction: deductionAmount,
        refund: refundAmount,
        deduction_percent: deductionPercent,
        policy_type: "standard",
        slab_info: slabInfo,
        time_remaining_hours: Math.max(0, timeDifferenceHours),
        message: message,
        trek_price: trekPrice
    };
}

/**
 * Determine payment status from booking data
 * @param {Object} booking - Booking object
 * @returns {string} Payment status ("advance_only" or "full_paid")
 */
function determinePaymentStatus(booking) {
    // This is a simplified logic - you may need to adjust based on your actual payment tracking
    if (booking.payment_status === "partial") {
        return "advance_only";
    } else if (booking.payment_status === "completed") {
        return "full_paid";
    } else {
        // Default to advance_only for pending/failed payments
        return "advance_only";
    }
}

/**
 * Calculate advance amount from booking data
 * @param {Object} booking - Booking object
 * @returns {number} Advance amount
 */
function calculateAdvanceAmount(booking) {
    // This is a simplified calculation - you may need to adjust based on your actual advance calculation logic
    // For now, assuming advance is 20% of total amount
    const advancePercentage = 0.20; // 20%
    return roundHalfUp(booking.total_amount * advancePercentage);
}

/**
 * Get policy settings from database
 * @param {Object} models - Sequelize models object
 * @param {string} policyType - "flexible" or "standard"
 * @returns {Object} Policy settings
 */
async function getPolicySettings(models, policyType) {
    try {
        const { CancellationPolicySettings } = models;
        const settings = await CancellationPolicySettings.findOne({
            where: { 
                policy_type: policyType,
                is_active: true 
            },
            order: [['created_at', 'DESC']]
        });
        
        return settings;
    } catch (error) {
        console.error('Error fetching policy settings:', error);
        return null;
    }
}

/**
 * Calculate Flexible Policy Refund V2 - New logic based on detailed requirements
 * @param {Object} params - Calculation parameters
 * @param {number} params.finalAmount - Final booking amount
 * @param {number} params.platformFees - Platform fees
 * @param {number} params.gstAmount - GST amount
 * @param {number} params.insuranceAmount - Insurance amount
 * @param {number} params.freeCancellationAmount - Free cancellation coverage amount
 * @param {number} params.advanceAmount - Advance amount paid
 * @param {boolean} params.hasFreeCancellation - Whether free cancellation is available
 * @param {number} params.timeRemainingHours - Time remaining before trek starts
 * @param {number} params.bookingId - Booking ID for logging
 * @param {string} params.policyName - Policy name
 * @returns {Object} Refund calculation result
 */
function calculateFlexibleRefundV2({
    finalAmount,
    platformFees,
    gstAmount,
    insuranceAmount,
    freeCancellationAmount,
    advanceAmount,
    hasFreeCancellation,
    timeRemainingHours,
    bookingId,
    policyName
}) {
    const refundItems = [];
    const loseItems = [];
    let totalRefundAmount = 0;
    let totalDeductionAmount = 0;

    console.log("🔍 Flexible Refund V2 Calculation:", {
        bookingId,
        finalAmount,
        platformFees,
        gstAmount,
        insuranceAmount,
        freeCancellationAmount,
        advanceAmount,
        hasFreeCancellation,
        timeRemainingHours
    });

    // Check if trek has already started/finished (past date)
    if (timeRemainingHours <= 0) {
        return {
            refund: 0,
            deduction: roundHalfUp(finalAmount),
            policy_type: "flexible",
            policy_name: policyName,
            time_remaining_hours: timeRemainingHours,
            within_24_hours: true,
            free_cancellation: hasFreeCancellation,
            refund_items: [],
            lose_items: [
                { item: "Complete Amount (Trek Completed/Started)", amount: roundHalfUp(finalAmount) }
            ],
            total_final_amount: finalAmount,
            message: "No refund available - Trek has already started or completed"
        };
    }

    // Determine if within 24 hours
    const within24Hours = timeRemainingHours <= 24;
    
    // Fixed advance amount as per flexible policy requirement
    const fixedAdvanceAmount = 999;
    
    if (hasFreeCancellation) {
        // Case: free_cancellation = "yes"
        if (within24Hours) {
            // Within or at 24 hours
            // Refund calculation: GST only
            totalRefundAmount = roundHalfUp(gstAmount);
            refundItems.push({
                item: "GST",
                amount: roundHalfUp(gstAmount)
            });
            
            // Lose: advance (999 fixed), free cancellation fee, platform fee, insurance
            loseItems.push({ item: "Advance Payment", amount: fixedAdvanceAmount });
            totalDeductionAmount += fixedAdvanceAmount;
            if (freeCancellationAmount > 0) {
                loseItems.push({ item: "Free Cancellation Fee", amount: roundHalfUp(freeCancellationAmount) });
                totalDeductionAmount += freeCancellationAmount;
            }
            if (platformFees > 0) {
                loseItems.push({ item: "Platform Fee", amount: roundHalfUp(platformFees) });
                totalDeductionAmount += platformFees;
            }
            if (insuranceAmount > 0) {
                loseItems.push({ item: "Insurance", amount: roundHalfUp(insuranceAmount) });
                totalDeductionAmount += insuranceAmount;
            }
        } else {
            // More than 24 hours before trek
            // Refund calculation: final_amount - free_cancellation_fee - platform_fee - insurance
            totalDeductionAmount = 0;
            if (freeCancellationAmount > 0) {
                loseItems.push({ item: "Free Cancellation Fee", amount: roundHalfUp(freeCancellationAmount) });
                totalDeductionAmount += freeCancellationAmount;
            }
            if (platformFees > 0) {
                loseItems.push({ item: "Platform Fee", amount: roundHalfUp(platformFees) });
                totalDeductionAmount += platformFees;
            }
            if (insuranceAmount > 0) {
                loseItems.push({ item: "Insurance", amount: roundHalfUp(insuranceAmount) });
                totalDeductionAmount += insuranceAmount;
            }
            
            totalRefundAmount = roundHalfUp(finalAmount - totalDeductionAmount);
            refundItems.push({ item: "Net Refund Amount", amount: totalRefundAmount });
        }
    } else {
        // Case: free_cancellation = "no"
        if (within24Hours) {
            // Within or at 24 hours
            // Refund calculation: GST only
            totalRefundAmount = roundHalfUp(gstAmount);
            if (gstAmount > 0) {
                refundItems.push({ item: "GST", amount: roundHalfUp(gstAmount) });
            }
            
            // Lose: advance (999 fixed), platform fee, insurance
            loseItems.push({ item: "Advance Payment", amount: fixedAdvanceAmount });
            totalDeductionAmount += fixedAdvanceAmount;
            if (platformFees > 0) {
                loseItems.push({ item: "Platform Fee", amount: roundHalfUp(platformFees) });
                totalDeductionAmount += platformFees;
            }
            if (insuranceAmount > 0) {
                loseItems.push({ item: "Insurance", amount: roundHalfUp(insuranceAmount) });
                totalDeductionAmount += insuranceAmount;
            }
        } else {
            // More than 24 hours before trek
            // Refund calculation: final_amount - 999 - platform_fee - insurance
            totalDeductionAmount = 0;
            loseItems.push({ item: "Advance Payment", amount: fixedAdvanceAmount });
            totalDeductionAmount += fixedAdvanceAmount;
            if (platformFees > 0) {
                loseItems.push({ item: "Platform Fee", amount: roundHalfUp(platformFees) });
                totalDeductionAmount += platformFees;
            }
            if (insuranceAmount > 0) {
                loseItems.push({ item: "Insurance", amount: roundHalfUp(insuranceAmount) });
                totalDeductionAmount += insuranceAmount;
            }
            
            totalRefundAmount = roundHalfUp(finalAmount - totalDeductionAmount);
            refundItems.push({ item: "Net Refund Amount", amount: totalRefundAmount });
        }
    }

    // Calculate final deduction as final_amount - refund_amount
    const finalDeduction = roundHalfUp(finalAmount - totalRefundAmount);

    return {
        refund: totalRefundAmount,
        deduction: finalDeduction,
        policy_type: "flexible",
        policy_name: policyName,
        time_remaining_hours: timeRemainingHours,
        within_24_hours: within24Hours,
        free_cancellation: hasFreeCancellation,
        refund_items: refundItems,
        lose_items: loseItems,
        total_final_amount: finalAmount
    };
}

module.exports = {
    roundHalfUp,
    calculateFlexibleRefund,
    calculateFlexibleRefundV2,
    calculateStandardRefund,
    determinePaymentStatus,
    calculateAdvanceAmount,
    getPolicySettings
};
