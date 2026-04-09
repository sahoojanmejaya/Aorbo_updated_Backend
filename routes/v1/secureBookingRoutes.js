const express = require("express");
const router = express.Router();
const { authenticateCustomer } = require("../../middleware/customerAuthMiddleware");
const { 
    rateLimiters, 
    handleValidationErrors,
    validateOwnership,
    auditLogger 
} = require("../../middleware/securityMiddleware");
const { Booking } = require("../../models");
const {
    calculateFare,
    calculateFareValidation,
    createOrder,
    createOrderValidation,
    verifyPayment,
    verifyPaymentValidation,
    getMyBookings,
    getBookingDetails
} = require("../../controllers/v1/secureBookingController");
const {
    getCancellationRefundDetails,
    confirmCancellation,
    cancelBooking
} = require("../../controllers/v1/newBookingController");

// All routes require customer authentication
router.use(authenticateCustomer);

/**
 * Step 1: Calculate fare (server-side)
 * POST /v1/bookings/calculate-fare
 */
router.post(
    "/calculate-fare",
    rateLimiters.api,
    calculateFareValidation,
    handleValidationErrors,
    auditLogger("fare_calculated", "booking"),
    calculateFare
);

/**
 * Step 2: Create Razorpay order
 * POST /v1/bookings/create-order
 */
router.post(
    "/create-order",
    rateLimiters.booking,
    createOrderValidation,
    handleValidationErrors,
    auditLogger("order_created", "booking"),
    createOrder
);

/**
 * Step 3: Verify payment and create booking
 * POST /v1/bookings/verify-payment
 */
router.post(
    "/verify-payment",
    rateLimiters.payment,
    verifyPaymentValidation,
    handleValidationErrors,
    auditLogger("payment_verified", "booking"),
    verifyPayment
);

/**
 * Get customer bookings
 * GET /v1/bookings
 */
router.get(
    "/",
    rateLimiters.api,
    getMyBookings
);

/**
 * Get cancellation/refund details
 * GET /v1/bookings/cancellation-refund/:booking_id
 */
router.get(
    "/cancellation-refund/:booking_id",
    rateLimiters.api,
    getCancellationRefundDetails
);

/**
 * Confirm cancellation
 * POST /v1/bookings/confirm-cancellation
 */
router.post(
    "/confirm-cancellation",
    rateLimiters.api,
    confirmCancellation
);

/**
 * Get booking details
 * GET /v1/bookings/:id
 */
router.get(
    "/:id",
    rateLimiters.api,
    validateOwnership(Booking, "id", "customer_id"),
    getBookingDetails
);

/**
 * Cancel booking
 * PUT /v1/bookings/:id/cancel
 */
router.put(
    "/:id/cancel",
    rateLimiters.api,
    cancelBooking
);

module.exports = router;
