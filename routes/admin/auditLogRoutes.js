/**
 * Audit Log Routes for Admin Panel
 * 
 * @description Admin routes for system audit log operations
 * @author Kiro AI Assistant
 * @created 2026-03-09 15:54:00 IST
 * @updated 2026-03-09 15:54:00 IST
 */

const express = require('express');
const router = express.Router();
const auditLogController = require('../../controllers/admin/auditLogController');

/**
 * @route   GET /api/admin/audit-logs
 * @desc    Get audit logs with filters
 * @access  Private (Admin only)
 * @created 2026-03-09 15:54:00 IST
 */
router.get('/', auditLogController.getAuditLogs);

/**
 * @route   GET /api/admin/audit-logs/modules
 * @desc    Get available audit modules
 * @access  Private (Admin only)
 * @created 2026-03-09 15:54:00 IST
 */
router.get('/modules', auditLogController.getAuditModules);

/**
 * @route   GET /api/admin/audit-logs/statistics
 * @desc    Get audit log statistics
 * @access  Private (Admin only)
 * @created 2026-03-09 15:54:00 IST
 */
router.get('/statistics', auditLogController.getAuditStatistics);

/**
 * @route   GET /api/admin/audit-logs/:id
 * @desc    Get specific audit log details
 * @access  Private (Admin only)
 * @created 2026-03-09 15:54:00 IST
 */
router.get('/:id', auditLogController.getAuditLogById);

module.exports = router;