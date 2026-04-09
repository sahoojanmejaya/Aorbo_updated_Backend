/**
 * Redemption Routes for Admin Panel
 * 
 * @description Admin routes for coupon redemption operations
 * @author Kiro AI Assistant
 * @created 2026-03-09 16:18:00 IST
 * @updated 2026-03-09 16:18:00 IST
 */

const express = require('express');
const router = express.Router();
const redemptionController = require('../../controllers/admin/redemptionController');

/**
 * @route   GET /api/admin/redemptions
 * @desc    Get all redemptions with filters
 * @access  Private (Admin only)
 * @created 2026-03-09 16:18:00 IST
 */
router.get('/', redemptionController.getAllRedemptions);

/**
 * @route   GET /api/admin/redemptions/statistics
 * @desc    Get redemption statistics
 * @access  Private (Admin only)
 * @created 2026-03-09 16:18:00 IST
 */
router.get('/statistics', redemptionController.getRedemptionStatistics);

/**
 * @route   GET /api/admin/redemptions/:id
 * @desc    Get specific redemption details
 * @access  Private (Admin only)
 * @created 2026-03-09 16:18:00 IST
 */
router.get('/:id', redemptionController.getRedemptionById);

/**
 * @route   PUT /api/admin/redemptions/:id/status
 * @desc    Update redemption status
 * @access  Private (Admin only)
 * @created 2026-03-09 16:18:00 IST
 */
router.put('/:id/status', redemptionController.updateRedemptionStatus);

module.exports = router;