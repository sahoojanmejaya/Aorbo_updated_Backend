const express = require("express");
const router = express.Router();
const newBookingController = require("../../controllers/v1/newBookingController");
const bookingController = require("../../controllers/v1/bookingController");
const { authenticateCustomer } = require("../../middleware/customerAuthMiddleware");
const { paymentLimiter, cancellationLimiter } = require("../../middleware/securityMiddleware");

// All routes require customer authentication
router.use(authenticateCustomer);

router.post("/", newBookingController.createBooking);
router.post("/create-trek-order", paymentLimiter, bookingController.createOrder);
router.post("/verify-payment", paymentLimiter, bookingController.verifyPayment);
router.get("/", newBookingController.getCustomerBookings);
router.get("/:id", newBookingController.getBookingDetails);
router.get("/cancellation-refund/:booking_id", newBookingController.getCancellationRefundDetails);
router.post("/confirm-cancellation", cancellationLimiter, newBookingController.confirmCancellation);
router.put("/:id/cancel", cancellationLimiter, newBookingController.cancelBooking);

module.exports = router;
