const express = require('express');
const router = express.Router();
const bookingDisputeController = require('../../controllers/vendor/bookingDisputeController');
const authMiddleware = require('../../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route   GET /api/vendor/booking-dispute/:bookingId
 * @desc    Get dispute information by booking ID for the authenticated vendor
 * @access  Vendor only
 * @params  bookingId - Booking ID
 * @returns {Object} - { booking_id, dispute_status, disputed_amount }
 */
router.get("/:bookingId", bookingDisputeController.getBookingDisputeInfo);

module.exports = router;
