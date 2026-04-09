const express = require('express');
const router = express.Router();
const bookingDisputeController = require('../../controllers/v1/bookingDisputeController');
const { authenticateCustomer } = require('../../middleware/customerAuthMiddleware');

/**
 * @route   GET /api/v1/booking-dispute/:bookingId
 * @desc    Get disputes for a booking (authenticated; ownership enforced in controller)
 * @access  Authenticated customer
 */
router.get("/:bookingId", authenticateCustomer, bookingDisputeController.getBookingDisputeStatus);

/**
 * @route   PUT /api/v1/booking-dispute/:bookingId/status
 * @desc    Update dispute status (authenticated; ownership enforced in controller)
 * @access  Authenticated customer
 */
router.put("/:bookingId/status", authenticateCustomer, bookingDisputeController.updateBookingDisputeStatus);

module.exports = router;
