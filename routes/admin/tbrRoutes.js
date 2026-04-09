/**
 * TBR (Trek Booking Reference) Routes for Admin Panel
 * 
 * @description Admin routes for TBR management operations
 * @author Kiro AI Assistant
 * @created 2026-03-09 15:50:00 IST
 * @updated 2026-03-09 15:50:00 IST
 */

const express = require('express');
const router = express.Router();
const tbrController = require('../../controllers/admin/tbrController');

/**
 * @route   GET /api/admin/tbrs
 * @desc    Get all TBRs with pagination and filters
 * @access  Private (Admin only)
 * @created 2026-03-09 15:50:00 IST
 */
router.get('/', tbrController.getTbrs);

/**
 * @route   GET /api/admin/tbrs/statistics
 * @desc    Get TBR statistics for dashboard
 * @access  Private (Admin only)
 * @created 2026-03-09 15:50:00 IST
 */
router.get('/statistics', tbrController.getTbrStatistics);

/**
 * @route   GET /api/admin/tbrs/:id
 * @desc    Get specific TBR details
 * @access  Private (Admin only)
 * @created 2026-03-09 15:50:00 IST
 */
router.get('/:id', tbrController.getTbrById);

/**
 * @route   PUT /api/admin/tbrs/:id/status
 * @desc    Update TBR status
 * @access  Private (Admin only)
 * @created 2026-03-09 15:50:00 IST
 */
router.put('/:id/status', tbrController.updateTbrStatus);

/**
 * @route   POST /api/admin/tbrs/:id/cancel
 * @desc    Cancel an entire batch/TBR
 * @access  Private (Admin only)
 */
router.post('/:id/cancel', tbrController.cancelBatch);

/**
 * @route   GET /api/admin/tbrs/:id/logs
 * @desc    Get TBR audit logs
 * @access  Private (Admin only)
 */
router.get('/:id/logs', tbrController.getTbrLogs);

module.exports = router;