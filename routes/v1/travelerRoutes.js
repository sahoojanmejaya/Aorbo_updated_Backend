const express = require("express");
const router = express.Router();
const travelerController = require("../../controllers/v1/travelerController");
const {
    authenticateCustomer,
} = require("../../middleware/customerAuthMiddleware");

// All routes require customer authentication
router.use(authenticateCustomer);

router.get("/", travelerController.getTravelers);
router.post("/", travelerController.createTraveler);
router.get("/:id", travelerController.getTravelerDetails);
router.put("/:id", travelerController.updateTraveler);
router.delete("/:id", travelerController.deleteTraveler);
router.get("/:id/bookings", travelerController.getTravelerBookings);

module.exports = router;
