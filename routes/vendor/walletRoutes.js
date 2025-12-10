const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const {
    getWalletBalance,
    getWalletTransactions,
    createWithdrawal,
    getWithdrawalHistory,
    getTbrBreakdown,
    getLockedBalanceDetails,
    getAvailableBalanceDetails,
    getTotalEarningsDetails,
    getPendingRefundsDetails,
    getAnalytics7Days,
    getAnalytics30Days,
    getAnalyticsYearly,
    getTotalEarnings7Days,
    getTotalEarnings30Days,
    getTotalEarningsYearly,
    getTbrBreakdownDetailed,
    createWithdrawalRequest,
    getWithdrawalHistoryNew,
} = require('../../controllers/vendor/walletController');

const { getDisputesData } = require('../../controllers/vendor/disputesController');

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route   GET /api/vendor/wallet/balance
 * @desc    Get vendor wallet balance and overview
 * @access  Private (Vendor)
 */
router.get('/balance', getWalletBalance);

/**
 * @route   GET /api/vendor/wallet/transactions
 * @desc    Get vendor wallet transactions with pagination and filters
 * @access  Private (Vendor)
 * @query   page, limit, search, type, status
 */
router.get('/transactions', getWalletTransactions);

/**
 * @route   GET /api/vendor/wallet/transaction-history
 * @desc    Get complete transaction history from booking data
 * @access  Private (Vendor)
 * @query   page, limit, search, type, status
 */
router.get('/transaction-history', getWalletTransactions);


/**
 * @route   POST /api/vendor/wallet/withdrawals
 * @desc    Create withdrawal request
 * @access  Private (Vendor)
 * @body    { amount: number, selectedTbrs?: string[] }
 */
router.post('/withdrawals', createWithdrawal);

/**
 * @route   GET /api/vendor/wallet/withdrawals
 * @desc    Get withdrawal history
 * @access  Private (Vendor)
 * @query   page, limit
 */
router.get('/withdrawals', getWithdrawalHistory);

/**
 * @route   GET /api/vendor/wallet/tbr-breakdown
 * @desc    Get TBR breakdown for withdrawals
 * @access  Private (Vendor)
 */
router.get('/tbr-breakdown', getTbrBreakdown);

/**
 * @route   GET /api/vendor/wallet/locked-balance-details
 * @desc    Get locked balance details for trek batches within 2-day window
 * @access  Private (Vendor)
 * @description Calculates locked amount for batches starting from (current_date - 2 days) to current_date (inclusive)
 */
router.get('/locked-balance-details', getLockedBalanceDetails);

/**
 * @route   GET /api/vendor/wallet/available-balance-details
 * @desc    Get available balance details for batches with start_date <= (today - 3 days)
 * @access  Private (Vendor)
 */
router.get('/available-balance-details', getAvailableBalanceDetails);

/**
 * @route   GET /api/vendor/wallet/total-earnings-details
 * @desc    Get total earnings details for batches with start_date <= current_date
 * @access  Private (Vendor)
 */
router.get('/total-earnings-details', getTotalEarningsDetails);

/**
 * @route   GET /api/vendor/wallet/pending-refunds-details
 * @desc    Get pending refunds details based on disputed amounts in issue_reports
 * @access  Private (Vendor)
 */
router.get('/pending-refunds-details', getPendingRefundsDetails);

/**
 * @route   GET /api/vendor/wallet/analytics-7days
 * @desc    Get analytics insights for last 7 days
 * @access  Private (Vendor)
 */
router.get('/analytics-7days', getAnalytics7Days);

/**
 * @route   GET /api/vendor/wallet/analytics-30days
 * @desc    Get analytics insights for last 30 days
 * @access  Private (Vendor)
 */
router.get('/analytics-30days', getAnalytics30Days);

/**
 * @route   GET /api/vendor/wallet/analytics-yearly
 * @desc    Get analytics insights for last 1 year
 * @access  Private (Vendor)
 */
router.get('/analytics-yearly', getAnalyticsYearly);

/**
 * @route   GET /api/vendor/wallet/tbr-breakdown-detailed
 * @desc    Get detailed TBR-wise breakdown with batch information
 * @access  Private (Vendor)
 * @description Returns detailed breakdown for each TBR including batch info, bookings, customers, base price, cancellations, platform commission, and net amount
 */
router.get('/tbr-breakdown-detailed', getTbrBreakdownDetailed);

/**
 * @route   POST /api/vendor/wallet/withdrawal-request
 * @desc    Create a new withdrawal request
 * @access  Private (Vendor)
 * @description Creates a new withdrawal request with auto-generated withdrawal ID and status
 */
router.post('/withdrawal-request', createWithdrawalRequest);

/**
 * @route   GET /api/vendor/wallet/withdrawal-history-new
 * @desc    Get withdrawal history using new withdrawal table
 * @access  Private (Vendor)
 * @description Returns withdrawal history from the new withdrawals table
 */
router.get('/withdrawal-history-new', getWithdrawalHistoryNew);

/**
 * @route   GET /api/vendor/wallet/total-earnings-7days
 * @desc    Get Total Earnings for last 6 days
 * @access  Private (Vendor)
 */
router.get('/total-earnings-7days', getTotalEarnings7Days);

/**
 * @route   GET /api/vendor/wallet/total-earnings-30days
 * @desc    Get Total Earnings for last 30 days
 * @access  Private (Vendor)
 */
router.get('/total-earnings-30days', getTotalEarnings30Days);

/**
 * @route   GET /api/vendor/wallet/total-earnings-yearly
 * @desc    Get Total Earnings for last 364 days
 * @access  Private (Vendor)
 */
router.get('/total-earnings-yearly', getTotalEarningsYearly);

/**
 * @route   GET /api/vendor/wallet/disputes
 * @desc    Get disputes data for vendor wallet page
 * @access  Private (Vendor)
 */
router.get('/disputes', getDisputesData);

module.exports = router;



