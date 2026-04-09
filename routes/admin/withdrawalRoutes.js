/**
 * Withdrawal Routes for Admin Panel
 * 
 * @description Admin routes for vendor withdrawal operations
 * @author Kiro AI Assistant
 * @created 2026-03-09 16:19:00 IST
 * @updated 2026-03-16 18:56:00 IST
 */

const express = require('express');
const router = express.Router();
const withdrawalController = require('../../controllers/admin/withdrawalController');

/**
 * @route   GET /api/admin/withdrawals
 * @desc    Get all withdrawals with filters
 * @access  Private (Admin only)
 * @created 2026-03-09 16:19:00 IST
 */
router.get('/', withdrawalController.getAllWithdrawals);

/**
 * @route   GET /api/admin/withdrawals/pending
 * @desc    Get pending withdrawals
 * @access  Private (Admin only)
 * @created 2026-03-16 18:56:00 IST
 */
router.get('/pending', withdrawalController.getPendingWithdrawals);

/**
 * @route   GET /api/admin/withdrawals/:id
 * @desc    Get specific withdrawal details
 * @access  Private (Admin only)
 * @created 2026-03-09 16:19:00 IST
 */
router.get('/:id', withdrawalController.getWithdrawalById);

/**
 * @route   PUT /api/admin/withdrawals/:id/approve
 * @desc    Approve withdrawal request
 * @access  Private (Admin only)
 * @created 2026-03-09 16:19:00 IST
 */
router.put('/:id/approve', withdrawalController.approveWithdrawal);

/**
 * @route   PUT /api/admin/withdrawals/:id/reject
 * @desc    Reject withdrawal request
 * @access  Private (Admin only)
 * @created 2026-03-09 16:19:00 IST
 */
router.put('/:id/reject', withdrawalController.rejectWithdrawal);

/**
 * @route   PUT /api/admin/withdrawals/:id/status
 * @desc    Update withdrawal status
 * @access  Private (Admin only)
 * @created 2026-03-09 16:19:00 IST
 */
router.put('/:id/status', withdrawalController.updateWithdrawalStatus);

module.exports = router;