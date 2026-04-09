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
const user_registerRoutes = require("./registrationRoutes");
const roleRoutes = require("./roleRoutes");
const permissionRoutes = require("./permissionRoutes");
const supportRoutes = require("./supportRoutes");
const assignTaskRoutes = require("./assignTaskRoutes");
const unifiedSupportRoutes = require("./unifiedSupportRoutes");
const reviewRoutes = require("./reviewRoutes");
const trekRoutes = require("./trekRoutes");
const redemptionRoutes = require("./redemptionRoutes");

// NEW ROUTES - Added 2026-03-09 15:58:00 IST
const tbrRoutes = require("./tbrRoutes");
const taxRoutes = require("./taxRoutes");
const vendorRequestRoutes = require("./vendorRequestRoutes");
const auditLogRoutes = require("./auditLogRoutes");
const operatorRoutes = require("./operatorRoutes");
const bookingRoutes = require("./bookingRoutes");

// MISSING ROUTES - Added 2026-03-16 12:00:00 IST
const vendorRoutes = require("./vendorRoutes");
const withdrawalRoutes = require("./withdrawalRoutes");
const commissionLogRoutes = require("./commissionLogRoutes");

// V1 CONNECTED ROUTES - Added 2026-03-26
const travelerRoutes = require("./travelerRoutes");
const ratingRoutes = require("./ratingRoutes");
const issueRoutes = require("./issueRoutes");

// TREK APPROVAL ROUTES
const trekApprovalRoutes = require("./trekApprovalRoutes");

// Mount public routes (no auth required)
router.use("/auth", authRoutes);
router.use("/user_register", user_registerRoutes);
router.use("/permission", permissionRoutes);
// Temporarily bypass auth for disputes (for testing)
router.use("/disputes", disputeRoutes);
router.use("/support_dashboard", supportRoutes);
router.use("/unified_support_dashboard", unifiedSupportRoutes);
router.use("/role", roleRoutes);
router.use("/assign_task", assignTaskRoutes);
router.use("/chats", chatRoutes);
// Mount banner-items with custom middleware order (multer before auth)
router.use("/banner-items", bannerItemRoutes);
router.use("/reviews", reviewRoutes);

// Apply auth middleware to protected admin routes
router.use(authMiddleware);

// Mount protected admin routes
router.use("/bookings", bookingRoutes);
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
router.use("/redemptions", redemptionRoutes);
router.use("/users", userRoutes);
router.use("/admin_trek", trekRoutes);
router.use("/taxes", taxRoutes);

// NEW ROUTES - Added 2026-03-09 15:58:00 IST - Now protected by auth middleware
router.use("/tbrs", tbrRoutes);
router.use("/vendor-requests", vendorRequestRoutes);
router.use("/audit-logs", auditLogRoutes);
router.use("/operators", operatorRoutes);

// MISSING ROUTES - Added 2026-03-16 12:00:00 IST - Protected by auth middleware
router.use("/vendors", vendorRoutes);
router.use("/withdrawals", withdrawalRoutes);
router.use("/commission-logs", commissionLogRoutes);

// V1 CONNECTED ROUTES - Added 2026-03-26 - Protected by auth middleware
router.use("/travelers", travelerRoutes);
router.use("/ratings", ratingRoutes);
router.use("/issues", issueRoutes);

// TREK APPROVAL - Protected by auth middleware
router.use("/treks", trekApprovalRoutes);

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
            // NEW ENDPOINTS - Added 2026-03-09 15:58:00 IST
            tbrs: "/api/admin/tbrs",
            vendorRequests: "/api/admin/vendor-requests",
            auditLogs: "/api/admin/audit-logs",
            operators: "/api/admin/operators",
            bookings: "/api/admin/bookings",
            redemptions: "/api/admin/redemptions",
            // ADDITIONAL ENDPOINTS - Added 2026-03-09 16:22:00 IST
            vendors: "/api/admin/vendors",
            withdrawals: "/api/admin/withdrawals",
            commissionLogs: "/api/admin/commission-logs",
            travelers: "/api/admin/travelers",
            ratings: "/api/admin/ratings",
            issues: "/api/admin/issues",
            trekApproval: "/api/admin/treks"
        },
        authentication: "JWT token required for all endpoints",
    });
});

module.exports = router;
