const express = require("express");
const router = express.Router();
const customerController = require("../../controllers/vendor/customerController");
const travelerController = require("../../controllers/vendor/travelerController");

// Vendor customer routes
router.get("/", customerController.getVendorCustomers);
router.get("/analytics", customerController.getCustomerAnalytics);
router.get("/booking/:bookingId/travelers", customerController.getBookingTravelers);
router.get("/overview", customerController.getVendorCustomerOverview);
router.get("/all", customerController.getAllVendorCustomers);
router.get("/:id", customerController.getCustomerById);
router.post("/", customerController.createCustomer);
router.put("/:id", customerController.updateCustomer);

// Traveler routes for customers
router.get("/:id/travelers", travelerController.getCustomerTravelers);
router.get(
    "/:customerId/travelers/:travelerId",
    travelerController.getTravelerDetails
);

// Placeholder routes for future implementation
router.get("/:id/bookings", (req, res) => {
    res.json({
        message: "Get vendor customer bookings endpoint - to be implemented",
    });
});

module.exports = router;
