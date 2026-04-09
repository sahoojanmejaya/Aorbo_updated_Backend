const router = require("express").Router();
const controller = require("../controllers/cancellation.controller");

router.post(
  "/tbrs/:tbrId/bookings/:bookingId/cancellation-preview",
  controller.preview
);

module.exports = router;
