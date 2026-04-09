/**
 * Commission Log Routes for Admin Panel
 * 
 * @description Admin routes for commission tracking operations
 * @author Kiro AI Assistant
 * @created 2026-03-09 16:20:00 IST
 * @updated 2026-03-16 18:55:00 IST
 */

const express = require('express');
const router = express.Router();
const commissionLogController = require('../../controllers/admin/commissionLogController');

/**
 * @route   GET /api/admin/commission-logs
 * @desc    Get all commission logs with filters
 * @access  Private (Admin only)
 * @created 2026-03-09 16:20:00 IST
 */
router.get('/', commissionLogController.getAllCommissionLogs);

/**
 * @route   GET /api/admin/commission-logs/statistics
 * @desc    Get commission statistics
 * @access  Private (Admin only)
 * @created 2026-03-09 16:20:00 IST
 */
router.get('/statistics', commissionLogController.getCommissionSummary);

/**
 * @route   GET /api/admin/commission-logs/:id
 * @desc    Get specific commission log details
 * @access  Private (Admin only)
 * @created 2026-03-09 16:20:00 IST
 */
router.get('/:id', commissionLogController.getCommissionLogById);

/**
 * @route   GET /api/admin/commission-logs/vendor/:id
 * @desc    Get commission logs for specific vendor
 * @access  Private (Admin only)
 * @created 2026-03-16 18:55:00 IST
 */
router.get('/vendor/:id', commissionLogController.getVendorCommissionLogs);

module.exports = router;