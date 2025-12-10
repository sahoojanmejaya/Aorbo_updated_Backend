/**
 * Platform Configuration for Wallet & Commission System
 * All configurable values for the wallet system
 */

module.exports = {
    // Commission percentage (10% = 0.10)
    COMMISSION_PCT: 0.10,

    // Platform share of remaining amount after refund for Standard bookings
    // Vendor gets (1 - PLATFORM_CANCELLATION_VENDOR_SHARE_RATIO) of remaining
    PLATFORM_CANCELLATION_VENDOR_SHARE_RATIO: 0.50,

    // Timezone for all wallet operations
    TIMEZONE: 'Asia/Kolkata',

    // Week start day for withdrawal window (0 = Sunday)
    WEEK_START_DAY: 0,

    // Settlement period: funds locked for X days after trek completion
    SETTLEMENT_PERIOD_DAYS: 3,

    // Flexible payment amount (non-refundable)
    FLEXIBLE_PAYMENT_AMOUNT: 999,

    // Withdrawal settings
    WITHDRAWAL: {
        // Minimum withdrawal amount
        MIN_AMOUNT: 100,
        // Maximum withdrawal amount (null = no limit except available balance)
        MAX_AMOUNT: null,
        // Withdrawals allowed per week
        WITHDRAWALS_PER_WEEK: 1,
    },

    // Refund slabs for Standard bookings (example - should be configurable per trek)
    REFUND_SLABS: [
        { days_before_departure: 30, refund_percentage: 0.90 }, // 90% refund if >30 days
        { days_before_departure: 15, refund_percentage: 0.75 }, // 75% refund if >15 days
        { days_before_departure: 7, refund_percentage: 0.50 },  // 50% refund if >7 days
        { days_before_departure: 3, refund_percentage: 0.25 },  // 25% refund if >3 days
        { days_before_departure: 0, refund_percentage: 0.00 },  // No refund if <3 days
    ],

    // Dispute SLA (hours)
    DISPUTE_SLA_HOURS: 72,

    // Currency
    CURRENCY: 'INR',
    CURRENCY_SYMBOL: '₹',
};




