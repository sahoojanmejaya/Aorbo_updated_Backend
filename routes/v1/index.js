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
// ✅ ADMIN CONTROL: Use secure booking routes instead of old customer booking routes
const secureBookingRoutes = require("./secureBookingRoutes");
const customerBookingRoutes = require("./customerBookingRoutes");
const travelerRoutes = require("./travelerRoutes");
const emergencyContactRoutes = require("./emergencyContactRoutes");
const ratingRoutes = require("./ratingRoutes");
const issueRoutes = require("./issueRoutes");
const bookingDisputeRoutes = require("./bookingDisputeRoutes");
const chatRoutes = require("./chatRoutes");

// Mount existing routes (for mobile app)
router.use("/treks", trekRoutes);
router.use("/coupons", couponRoutes);
router.use("/states", stateRoutes);
router.use("/cities", cityRoutes);
router.use("/destinations", destinationRoutes);

// Mount new customer-centric routes (for mobile app)
router.use("/customer/auth", customerAuthRoutes);
// ✅ ADMIN CONTROL: Secure 3-step booking flow with server-side validation
router.use("/bookings", secureBookingRoutes);
// Mobile app booking routes (Flutter app compatible field names)
router.use("/customer/bookings", customerBookingRoutes);
router.use("/customer/travelers", travelerRoutes);
router.use("/customer/emergency-contacts", emergencyContactRoutes);
router.use("/ratings", ratingRoutes);
router.use("/issues", issueRoutes);
router.use("/booking-dispute", bookingDisputeRoutes);
router.use("/customer/chats", chatRoutes);

// API version info
router.get("/", (req, res) => {
    res.json({
        version: "1.0.0",
        name: "Arobo Trekking Platform API v1 - Mobile Application API",
        description:
            "Customer-centric API for mobile booking application with phone-based authentication. ✅ ADMIN-CONTROLLED: All treks approved by admin, secure booking flow, routed communication.",
        endpoints: {
            // Customer endpoints (primary for mobile)
            customer_auth: "/api/v1/customer/auth",
            bookings: "/api/v1/bookings (SECURE 3-STEP FLOW)",
            travelers: "/api/v1/customer/travelers",
            emergency_contacts: "/api/v1/customer/emergency-contacts",
            ratings: "/api/v1/ratings",
            issues: "/api/v1/issues",
            booking_dispute: "/api/v1/booking-dispute",
            public_treks: "/api/v1/treks (ADMIN APPROVED ONLY)",
            coupons: "/api/v1/coupons (ADMIN APPROVED ONLY)",
            states: "/api/v1/states",
            cities: "/api/v1/cities",
            destinations: "/api/v1/destinations",
            chats: "/api/v1/customer/chats (ROUTED THROUGH ADMIN)"
        },
        authentication: {
            customer: "Phone-based OTP authentication",
        },
        admin_controls: {
            trek_visibility: "Only admin-approved treks visible",
            booking_flow: "Server-side fare calculation with commission tracking",
            communication: "All messages routed through admin agents",
            coupons: "Only admin-approved coupons available"
        }
    });
});

module.exports = router;
