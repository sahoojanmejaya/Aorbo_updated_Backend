const express = require("express");
const router = express.Router();
const analyticsController = require("../../controllers/vendor/analyticsController");
const authMiddleware = require("../../middleware/authMiddleware");

// Vendor analytics routes
router.get(
    "/dashboard",
    authMiddleware,
    analyticsController.getVendorDashboard
);

router.get(
    "/bookings",
    authMiddleware,
    analyticsController.getBookingAnalytics
);

router.get(
    "/revenue",
    authMiddleware,
    analyticsController.getRevenueAnalytics
);

router.get(
    "/treks",
    authMiddleware,
    analyticsController.getTrekPerformanceAnalytics
);

router.get(
    "/customers",
    authMiddleware,
    analyticsController.getCustomerAnalytics
);

router.get(
    "/realtime",
    authMiddleware,
    analyticsController.getRealTimeMetrics
);

module.exports = router;
