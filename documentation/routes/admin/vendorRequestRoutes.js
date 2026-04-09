/**
 * Vendor Request Routes for Admin Panel
 * 
 * @description Admin routes for vendor approval/rejection operations
 * @author Kiro AI Assistant
 * @created 2026-03-09 15:52:00 IST
 * @updated 2026-03-25 12:00:00 IST
 */

const express = require('express');
const router = express.Router();
const vendorRequestController = require('../../controllers/admin/vendorRequestController');

/**
 * @route   GET /api/admin/vendor-requests/pending
 * @desc    Get pending vendor requests
 * @access  Private (Admin only)
 * @created 2026-03-09 15:52:00 IST
 */
router.get('/pending', vendorRequestController.getPendingVendorRequests);

/**
 * @route   GET /api/admin/vendor-requests
 * @desc    Get all vendor requests with filters
 * @access  Private (Admin only)
 * @created 2026-03-09 15:52:00 IST
 */
router.get('/', vendorRequestController.getAllVendorRequests);

/**
 * @route   GET /api/admin/vendor-requests/:id
 * @desc    Get specific vendor request details
 * @access  Private (Admin only)
 * @created 2026-03-09 15:52:00 IST
 */
router.get('/:id', vendorRequestController.getVendorRequestById);

/**
 * @route   PUT /api/admin/vendor-requests/:id/approve
 * @desc    Approve vendor request
 * @access  Private (Admin only)
 * @created 2026-03-09 15:52:00 IST
 */
router.put('/:id/approve', vendorRequestController.approveVendorRequest);

/**
 * @route   PUT /api/admin/vendor-requests/:id/reject
 * @desc    Reject vendor request
 * @access  Private (Admin only)
 * @created 2026-03-09 15:52:00 IST
 */
router.put('/:id/reject', vendorRequestController.rejectVendorRequest);

/**
 * @route   PUT /api/admin/vendor-requests/:id/request-reverification
 * @desc    Request re-verification from vendor
 * @access  Private (Admin only)
 * @created 2026-03-25 12:00:00 IST
 */
// BUG #32 FIX: Added re-verification route
router.put('/:id/request-reverification', vendorRequestController.requestReverification);

module.exports = router;