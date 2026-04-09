const express = require("express");
const router = express.Router();

// Import v1 route modules
// Removed admin-dependent routes
const trekRoutes = require("./trekRoutes");
const couponRoutes = require("./couponRoutes");
const stateRoutes = require("./stateRoutes");
const cityRoutes = require("./cityRoutes");
const destinationRoutes = require("./destinationRoutes");

// New customer-centric routes
const customerAuthRoutes = require("./customerAuthRoutes");
const customerBookingRoutes = require("./customerBookingRoutes");
const travelerRoutes = require("./travelerRoutes");
const emergencyContactRoutes = require("./emergencyContactRoutes");
const ratingRoutes = require("./ratingRoutes");
const issueRoutes = require("./issueRoutes");
const bookingDisputeRoutes = require("./bookingDisputeRoutes");
const chatRoutes = require("./chatRoutes");
const discoveryRoutes = require("./discoveryRoutes");
const badgeRoutes = require("./badgeRoutes");
const deviceTokenRoutes = require("./deviceTokenRoutes");

// Mount existing routes (for mobile app)
router.use("/treks", trekRoutes);
router.use("/coupons", couponRoutes);
router.use("/states", stateRoutes);
router.use("/cities", cityRoutes);
router.use("/destinations", destinationRoutes);

// Mount new customer-centric routes (for mobile app)
router.use("/customer/auth", customerAuthRoutes);
router.use("/customer/bookings", customerBookingRoutes);
router.use("/customer/travelers", travelerRoutes);
router.use("/customer/emergency-contacts", emergencyContactRoutes);
router.use("/ratings", ratingRoutes);
router.use("/issues", issueRoutes);
router.use("/booking-dispute", bookingDisputeRoutes);
router.use("/customer/chats", chatRoutes);
router.use("/discovery", discoveryRoutes);
router.use("/badges", badgeRoutes);
router.use("/customer/device-token", deviceTokenRoutes);

// API version info
router.get("/", (req, res) => {
    res.json({
        version: "1.0.0",
        name: "Arobo Trekking Platform API v1 - Mobile Application API",
        description:
            "Customer-centric API for mobile booking application with phone-based authentication",
        endpoints: {
            // Customer endpoints (primary for mobile)
            customer_auth: "/api/v1/customer/auth",
            customer_bookings: "/api/v1/customer/bookings",
            travelers: "/api/v1/customer/travelers",
            emergency_contacts: "/api/v1/customer/emergency-contacts",
            ratings: "/api/v1/ratings",
            issues: "/api/v1/issues",
            booking_dispute: "/api/v1/booking-dispute",
            public_treks: "/api/v1/treks",
            coupons: "/api/v1/coupons",
            states: "/api/v1/states",
            cities: "/api/v1/cities",
            destinations: "/api/v1/destinations",
            discovery: "/api/v1/discovery",
            badges: "/api/v1/badges",
            device_token: "/api/v1/customer/device-token",
        },
        authentication: {
            customer: "Phone-based OTP authentication",
        },
    });
});

module.exports = router;
