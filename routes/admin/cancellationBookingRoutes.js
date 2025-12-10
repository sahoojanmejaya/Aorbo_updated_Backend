const express = require("express");
const router = express.Router();
const cancellationBookingController = require("../../controllers/admin/cancellationBookingController");

// Get all cancellation bookings (overview)
router.get("/", cancellationBookingController.getCancellationBookings);

// Get cancellation booking details by ID
router.get("/:id", cancellationBookingController.getCancellationBookingDetails);

// Update cancellation booking status
router.put("/:id/status", cancellationBookingController.updateCancellationStatus);

module.exports = router;
