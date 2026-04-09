const express = require("express");
const router = express.Router();
const controller = require("../controllers/booking.controller");

// 1️⃣ Pending balances
// 1️⃣ Pending balances
router.get("/pending-balances", controller.getPendingBalances);

// 4️⃣ Active Bookings (Taxes Panel)
router.get("/active", controller.getActiveBookings);

// 5️⃣ Summary (Taxes Panel)
router.get("/summary", controller.getBookingSummary);

// 2️⃣ Create booking
router.post("/", controller.createBooking);

// 3️⃣ Cancel booking (TBR-scoped)
// 3️⃣ Cancel booking (TBR-scoped)
router.post(
  "/:tbrId/bookings/:bookingId/cancel",
  controller.cancelBooking
);

// 3.5 Preview Cancellation
router.post(
  "/:tbrId/bookings/:bookingId/cancellation-preview",
  controller.previewCancellation
);

// 6️⃣ Get All Bookings
router.get("/", controller.getAllBookings);

// 7️⃣ Get Booking By ID
router.get("/:bookingId", controller.getBookingById);

// 8️⃣ Mark Collected (Vendor)
router.post("/:bookingId/mark-collected", controller.markCollected);

module.exports = router;
