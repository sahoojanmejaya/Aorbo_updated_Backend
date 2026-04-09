const express = require("express");
const router = express.Router();
const bookingController = require("../../controllers/vendor/bookingController");

// Vendor booking routes
router.get("/", bookingController.getVendorBookings);
router.get("/analytics", bookingController.getVendorBookingAnalytics);

// New dashboard endpoints
router.get("/overview", bookingController.getVendorDashboardOverview);
router.get("/trek-instances", bookingController.getVendorTrekInstances);
router.get("/batch/:batchId", bookingController.getBatchDetails);
router.get("/batch/:batchId/cancellations", bookingController.getBatchCancellations);
router.get("/cancellation/:bookingId", bookingController.getBookingCancellationDetails);

// Razorpay payment routes
router.post("/create-trek-order", bookingController.createTrekOrder);
router.post("/verify-payment", bookingController.verifyPaymentAndCreateBooking);

// Individual booking routes (must come after specific routes)
router.get("/:id", bookingController.getBookingById);
router.post("/", bookingController.createVendorBooking);
router.patch("/:id/status", bookingController.updateBookingStatus);
router.delete("/:id", bookingController.deleteBooking);

// Placeholder routes for future implementation
router.put("/:id", (req, res) => {
    res.json({ message: "Update vendor booking endpoint - to be implemented" });
});

router.post("/:id/cancel", (req, res) => {
    res.json({ message: "Cancel vendor booking endpoint - to be implemented" });
});

module.exports = router;
