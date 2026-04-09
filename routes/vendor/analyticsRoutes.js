const express = require("express");
const router = express.Router();
const analyticsController = require("../../controllers/vendor/analyticsController");

// Vendor analytics routes (auth applied globally in vendor/index.js)
router.get("/dashboard", analyticsController.getVendorDashboard);
router.get("/bookings", analyticsController.getBookingAnalytics);
router.get("/revenue", analyticsController.getRevenueAnalytics);
router.get("/treks", analyticsController.getTrekPerformanceAnalytics);
router.get("/customers", analyticsController.getCustomerAnalytics);
router.get("/realtime", analyticsController.getRealTimeMetrics);

module.exports = router;
