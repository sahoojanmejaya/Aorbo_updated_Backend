const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");

// Import vendor route modules
const taxRoutes = require("./taxesRoutes");
const authRoutes = require("./authRoutes");
const trekRoutes = require("./trekRoutes");
const bookingRoutes = require("./bookingRoutes");
const customerRoutes = require("./customerRoutes");
const locationRoutes = require("./locationRoutes");
const stateRoutes = require("./stateRoutes");
const analyticsRoutes = require("./analyticsRoutes");
const destinationRoutes = require("./destinationRoutes");
const couponRoutes = require("./couponRoutes");
const couponAuditRoutes = require("./couponAuditRoutes");
const activityRoutes = require("./activityRoutes");
const cancellationPolicyRoutes = require("./cancellationPolicyRoutes");
const boardingPointRoutes = require("./boardingPointRoutes");
const trekCaptainRoutes = require("./trekCaptainRoutes");
const inclusionRoutes = require("./inclusionRoutes");
const exclusionRoutes = require("./exclusionRoutes");
const holdRequestRoutes = require("./holdRequestRoutes");
const reviewRoutes = require("./reviewRoutes");
const batchRoutes = require("./batchRoutes");
const kycRoutes = require("./kycRoutes");
const disputeRoutes = require("./disputeRoutes");
const bookingDisputeRoutes = require("./bookingDisputeRoutes");
const walletRoutes = require("./walletRoutes");
const vendorRoutes = require("./vinRoutes");
const trekAdminRoutes = require("./trekAdminRoutes");

// Mount /auth routes (public: login/register)
router.use("/auth", authRoutes);

// Mount /kyc routes (mixed: some public, some protected)
router.use("/kyc", kycRoutes);

// Test endpoint for transaction history (remove in production)
router.get("/wallet/test-transactions", (req, res) => {
    const mockTransactions = [
        {
            id: "BK-540",
            date_time: "2025-01-16T10:30:00.000Z",
            booking_id: "BK-540",
            tbr_id: "TBRFQGXIVP",
            amount: 31672.9,
            type: "Payment",
            status: "Success",
            description: "Full payment received for Kashmir",
            trek_name: "Kashmir",
            trek_id: 93,
            payment_status: "full_paid",
            created_at: "2025-01-16T10:30:00.000Z",
            updated_at: "2025-01-16T10:30:00.000Z"
        },
        {
            id: "BK-540",
            date_time: "2025-01-16T10:30:00.000Z",
            booking_id: "BK-540",
            tbr_id: "TBRFQGXIVP",
            amount: -3167.29,
            type: "Commission",
            status: "Success",
            description: "",
            trek_name: "Kashmir",
            trek_id: 93,
            payment_status: "full_paid",
            created_at: "2025-01-16T10:30:00.000Z",
            updated_at: "2025-01-16T10:30:00.000Z"
        }
    ];

    res.json({
        success: true,
        data: mockTransactions,
        pagination: {
            currentPage: 1,
            totalPages: 1,
            totalCount: 2,
            itemsPerPage: 20
        }
    });
});

// Test endpoint for real transaction data without auth
router.get("/wallet/test-real-transactions", require('../../controllers/vendor/walletController').getWalletTransactions);

// Apply auth middleware to all other vendor routes
router.use(authMiddleware);

// Mount protected vendor routes
router.use("/treks", trekRoutes);
router.use("/bookings", bookingRoutes);
router.use("/customers", customerRoutes);
router.use("/locations", locationRoutes);
router.use("/states", stateRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/destinations", destinationRoutes);
router.use("/coupons/audit", couponAuditRoutes);
router.use("/coupons", couponRoutes);
router.use("/activities", activityRoutes);
router.use("/cancellation-policies", cancellationPolicyRoutes);
router.use("/boarding-points", boardingPointRoutes);
router.use("/trek-captains", trekCaptainRoutes);
router.use("/inclusions", inclusionRoutes);
router.use("/exclusions", exclusionRoutes);
router.use("/hold-requests", holdRequestRoutes);
router.use("/reviews", reviewRoutes);
router.use("/batches", batchRoutes);
router.use("/disputes", disputeRoutes);
router.use("/dispute-booking", bookingDisputeRoutes);
router.use("/wallet", walletRoutes);
router.use("/vindetails", vendorRoutes);
router.use("/trekdetails", trekAdminRoutes);
router.use("/taxes", taxRoutes);






// Vendor API info
router.get("/", (req, res) => {
    res.json({
        version: "1.0.0",
        name: "Arobo Vendor Panel API6666666",
        description: "Vendor-specific endpoints for the Arobo platform",
        endpoints: {
            auth: "/api/vendor/auth",
            kyc: "/api/vendor/kyc",
            treks: "/api/vendor/treks",
            bookings: "/api/vendor/bookings",
            customers: "/api/vendor/customers",
            locations: "/api/vendor/locations",
            analytics: "/api/vendor/analytics",
            destinations: "/api/vendor/destinations",
            boardingPoints: "/api/vendor/boarding-points",
            trekCaptains: "/api/vendor/trek-captains",
            reviews: "/api/vendor/reviews",
            wallet: "/api/vendor/wallet",
           taxes: "/api/vendor/taxes",
            
        },
          // 👇 ADD THIS
            
        authentication:
            "JWT token required for all endpoints except /auth/login and /auth/register",
    });
});

module.exports = router;
