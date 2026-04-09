/**
 * Vendor Routes for Admin Panel
 * 
 * @description Admin routes for vendor management operations
 * @author Kiro AI Assistant
 * @created 2026-03-09 16:21:00 IST
 * @updated 2026-03-09 16:21:00 IST
 */

const express = require('express');
const router = express.Router();
const vendorController = require('../../controllers/admin/vendorController');

/**
 * @route   GET /api/admin/vendors
 * @desc    Get all vendors with filters
 * @access  Private (Admin only)
 * @created 2026-03-09 16:21:00 IST
 */
router.get('/', vendorController.getVendors);

/**
 * @route   GET /api/admin/vendors/statistics
 * @desc    Get vendor statistics
 * @access  Private (Admin only)
 * @created 2026-03-09 16:21:00 IST
 */
router.get('/statistics', vendorController.getVendorStatistics);

/**
 * @route   GET /api/admin/vendors/:id
 * @desc    Get specific vendor details
 * @access  Private (Admin only)
 * @created 2026-03-09 16:21:00 IST
 */
router.get('/:id', vendorController.getVendorById);

/**
 * @route   PUT /api/admin/vendors/:id
 * @desc    Update vendor details
 * @access  Private (Admin only)
 * @created 2026-03-09 16:21:00 IST
 */
router.put('/:id', vendorController.updateVendor);

/**
 * @route   PUT /api/admin/vendors/:id/status
 * @desc    Update vendor status
 * @access  Private (Admin only)
 * @created 2026-03-09 16:21:00 IST
 */
router.put('/:id/status', vendorController.updateVendorStatus);

/**
 * @route   DELETE /api/admin/vendors/:id
 * @desc    Delete/Deactivate vendor
 * @access  Private (Admin only)
 * @created 2026-03-09 16:21:00 IST
 */
router.delete('/:id', vendorController.deleteVendor);

module.exports = router;