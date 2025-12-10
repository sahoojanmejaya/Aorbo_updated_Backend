const express = require('express');
const router = express.Router();
const bookingDisputeController = require('../../controllers/v1/bookingDisputeController');

/**
 * @route   GET /api/v1/booking-dispute/:bookingId
 * @desc    Get ALL disputes for a booking ID with comprehensive information
 * @access  Public (no authentication required)
 * @params  bookingId - Booking ID (integer)
 * @returns {Object} - { 
 *   booking_id, 
 *   total_disputes, 
 *   total_disputed_amount, 
 *   overall_status, 
 *   overall_priority, 
 *   booking_status, 
 *   booking_amount, 
 *   disputes: [{ dispute_id, issue_type, issue_category, status, priority, disputed_amount, description, created_at, updated_at, resolved_at }],
 *   latest_dispute: { dispute_id, issue_type, status, priority, created_at }
 * }
 */
router.get("/:bookingId", bookingDisputeController.getBookingDisputeStatus);

/**
 * @route   PUT /api/v1/booking-dispute/:bookingId/status
 * @desc    Update dispute status by booking ID with proper flow logic
 * @access  Public (no authentication required)
 * @params  bookingId - Booking ID (integer)
 * @body    { status: string } - New status (pending, open, in_progress, resolved, closed)
 * @returns {Object} - Updated dispute information with status flow validation
 */
router.put("/:bookingId/status", bookingDisputeController.updateBookingDisputeStatus);

module.exports = router;
