const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");

// Import admin route modules
const authRoutes = require("./authRoutes");
const activityRoutes = require("./activityRoutes");
const badgeRoutes = require("./badgeRoutes");
const cancellationPolicyRoutes = require("./cancellationPolicyRoutes");
const locationRoutes = require("./locationRoutes");
const boardingPointRoutes = require("./boardingPointRoutes");
const couponRoutes = require("./couponRoutes");
const refundSettingsRoutes = require("./refundSettings");
const cancellationBookingRoutes = require("./cancellationBookingRoutes");
const cancellationPolicySettingsRoutes = require("./cancellationPolicySettingsRoutes");
const disputeRoutes = require("./disputeRoutes");
const bannerTypeRoutes = require("./bannerTypeRoutes");
const bannerItemRoutes = require("./bannerItemRoutes");
const emergencyContactRoutes = require("./emergencyContactRoutes");
const chatRoutes = require("./chatRoutes");
const userRoutes = require("./userRoutes");

// Mount public routes (no auth required)
router.use("/auth", authRoutes);

// Temporarily bypass auth for disputes (for testing)
router.use("/disputes", disputeRoutes);

// Mount banner-items with custom middleware order (multer before auth)
router.use("/banner-items", bannerItemRoutes);

// Apply auth middleware to protected admin routes
router.use(authMiddleware);

// Mount protected admin routes
router.use("/activities", activityRoutes);
router.use("/badges", badgeRoutes);
router.use("/cancellation-policies", cancellationPolicyRoutes);
router.use("/locations", locationRoutes);
router.use("/boarding-points", boardingPointRoutes);
router.use("/coupons", couponRoutes);
router.use("/refund-settings", refundSettingsRoutes);
router.use("/cancellation-bookings", cancellationBookingRoutes);
router.use("/cancellation-policy-settings", cancellationPolicySettingsRoutes);
router.use("/banner-types", bannerTypeRoutes);
router.use("/emergency-contacts", emergencyContactRoutes);
router.use("/chats", chatRoutes);
router.use("/users", userRoutes);
// banner-items is handled separately with custom middleware order

// Admin API info
router.get("/", (req, res) => {
    res.json({
        version: "1.0.0",
        name: "Arobo Admin Panel API",
        description: "Admin-specific endpoints for the Arobo platform",
        endpoints: {
            auth: "/api/admin/auth",
            activities: "/api/admin/activities",
            badges: "/api/admin/badges",
            cancellationPolicies: "/api/admin/cancellation-policies",
            locations: "/api/admin/locations",
            boardingPoints: "/api/admin/boarding-points",
            coupons: "/api/admin/coupons",
            refundSettings: "/api/admin/refund-settings",
            cancellationBookings: "/api/admin/cancellation-bookings",
            disputes: "/api/admin/disputes",
            bannerTypes: "/api/admin/banner-types",
            bannerItems: "/api/admin/banner-items",
            emergencyContacts: "/api/admin/emergency-contacts",
            chats: "/api/admin/chats",
        },
        authentication: "JWT token required for all endpoints",
    });
});

module.exports = router;
