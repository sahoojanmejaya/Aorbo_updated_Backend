const express = require('express');
const router = express.Router();
const disputeController = require('../../controllers/vendor/disputeController');
const authMiddleware = require('../../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route   GET /api/vendor/disputes/statistics
 * @desc    Get dispute statistics for vendor dashboard
 * @access  Vendor only
 */
router.get("/dashboard-stats", disputeController.getVendorDisputeStats);

/**
 * @route   GET /api/vendor/disputes
 * @desc    Get all disputes for the authenticated vendor with filtering and pagination
 * @access  Vendor only
 * @query   page, limit, status, priority, issue_type, search, sort_by, sort_order
 */
router.get("/", disputeController.getVendorDisputes);


/**
 * @route   GET /api/vendor/disputes/:id
 * @desc    Get dispute by ID for the authenticated vendor
 * @access  Vendor only
 * @params  id - Dispute ID
 */
router.get("/:id", disputeController.getVendorDisputeById);

module.exports = router;
