/**
 * Operator Routes for Admin Panel
 * 
 * @description Admin routes for operator/staff management operations
 * @author Kiro AI Assistant
 * @created 2026-03-09 15:56:00 IST
 * @updated 2026-03-09 15:56:00 IST
 */

const express = require('express');
const router = express.Router();
const operatorController = require('../../controllers/admin/operatorController');

/**
 * @route   GET /api/admin/operators
 * @desc    Get all operators with filters
 * @access  Private (Admin only)
 * @created 2026-03-09 15:56:00 IST
 */
router.get('/', operatorController.getOperators);

/**
 * @route   GET /api/admin/operators/statistics
 * @desc    Get operator statistics
 * @access  Private (Admin only)
 * @created 2026-03-09 15:56:00 IST
 */
router.get('/statistics', operatorController.getOperatorStatistics);

/**
 * @route   GET /api/admin/operators/:id
 * @desc    Get specific operator details
 * @access  Private (Admin only)
 * @created 2026-03-09 15:56:00 IST
 */
router.get('/:id', operatorController.getOperatorById);

/**
 * @route   POST /api/admin/operators
 * @desc    Create new operator
 * @access  Private (Admin only)
 * @created 2026-03-09 15:56:00 IST
 */
router.post('/', operatorController.createOperator);

/**
 * @route   PUT /api/admin/operators/:id
 * @desc    Update operator details
 * @access  Private (Admin only)
 * @created 2026-03-09 15:56:00 IST
 */
router.put('/:id', operatorController.updateOperator);

/**
 * @route   PUT /api/admin/operators/:id/status
 * @desc    Update operator status
 * @access  Private (Admin only)
 * @created 2026-03-09 15:56:00 IST
 */
router.put('/:id/status', operatorController.updateOperatorStatus);

/**
 * @route   DELETE /api/admin/operators/:id
 * @desc    Delete/Deactivate operator
 * @access  Private (Admin only)
 * @created 2026-03-09 15:56:00 IST
 */
router.delete('/:id', operatorController.deleteOperator);

module.exports = router;