const express = require("express");
const router = express.Router();
const disputeController = require("../../controllers/admin/disputeController");

/**
 * @route   GET /api/admin/disputes
 * @desc    Get all disputes with filtering and pagination
 * @access  Admin only
 * @query   page, limit, status, priority, issue_type, search, sort_by, sort_order
 */
router.get("/", disputeController.getAllDisputes);

/**
 * @route   GET /api/admin/disputes/stats
 * @desc    Get dispute statistics for dashboard
 * @access  Admin only
 */
router.get("/stats", disputeController.getDisputeStats);

/**
 * @route   GET /api/admin/disputes/:id
 * @desc    Get dispute by ID
 * @access  Admin only
 * @params  id - Dispute ID
 */
router.get("/:id", disputeController.getDisputeById);

/**
 * @route   PUT /api/admin/disputes/:id
 * @desc    Update dispute status, priority, assignment, or resolution notes
 * @access  Admin only
 * @params  id - Dispute ID
 * @body    status, priority, assigned_to, resolution_notes, disputed_amount
 */
router.put("/:id", disputeController.updateDispute);

module.exports = router;
