/**
 * Centralized Financial Configuration
 * Purpose: To avoid hardcoding values across the application.
 */

module.exports = {
    // Platform Fee (Standard per booking)
    PLATFORM_FEE: 1500,

    // Tax Rates
    GST_RATE_BASIC: 0.05,    // 5% on Basic Cost
    GST_RATE_PF: 0.05,       // 5% on Platform Fee (matches logic in repo)
    GST_RATE_COMM: 0.18,     // 18% on Commission

    // Commission Defaults
    COMMISSION_RATE: 0.10,   // 10% Standard

    // Compliance
    TCS_RATE: 0.01,
    TDS_RATE: 0.01
};
