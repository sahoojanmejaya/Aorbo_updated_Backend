const express = require("express");
const router = express.Router();
const trekController = require("../../controllers/vendor/trekAdminController");
const trekControllerUnified = require("../../controllers/vendor/trekControllerUnified");
const adminReviewController = require("../../controllers/admin/reviewController");

const {
    validateRequest,
    sanitizeInput,
    handleSequelizeErrors,
} = require("../../middleware/validationMiddleware");
const logger = require("../../utils/logger");

// GET Vendor Treks
router.get(
  "/admin_trek",
  trekController.getVendorTreks
);

router.get("/access-logs", trekController.getAccessLogs);
router.post("/access/insertion-access", trekController.manageAccessLog);
router.get("/admin_treks", trekController.getAdminAllBatches);
router.get("/dashboard_treks", trekController.getVendorTrekDashboardCounts);
router.get("/trek_list_booking", trekController.getVendorTrekInstances);

router.get("/cancle_trek", trekController.getVendorCustomerSummary);
router.get("/wallet_balance", trekController.getWalletBalance);

router.get("/wallet_transcations", trekController.getWalletTransactions);
router.get("/wallet_history", trekController.getWithdrawalHistory);

router.get("/wallet_batch_list", trekController.getTbrBreakdownDetailed);
router.get("/disputes_data", trekController.getDisputesData);

router.get("/coupon_list", trekController.getVendorCoupons);
router.get("/review_analytics", trekController.getVendorRatingAnalytics);
router.get("/review_list", trekController.getVendorReviews);

router.get("/coupon_audit_list", trekController.getVendorAuditLogs);
router.get("/coupons", trekController.getVendorAuditLogs);


router.get("/tbr-statistics", trekController.getTbrStatistics);
router.get("/pending-balance", trekController.getPendingBalanceCollection);
router.get("/admin_trek/:id", trekController.getTrekById);
router.get("/dashboard/trek-dashboard", trekController.getTrekDashboard);
router.post("/trek/update-status", trekController.updateTrekStatus);
router.post("/trek/booking-list", trekController.getVendorBookings);
router.post("/trek/cancel-booking", trekController.cancelBooking);

 router.get("/trek/audit-logs", trekController.getTrekAuditLogs);
 router.get("/trek/batch-data", trekController.getAllBatchFullData);




 router.get("/trek/audit-logs", trekController.getTrekAuditLogs);
 router.get("/trek/batch-data", trekController.getAllBatchFullData);


//router.post("/", validateTrek, trekController.createTrek);

// New unified trek creation endpoint (transactional)
// Note: This route is COMPLETELY handled in app.js with multer middleware
// router.post("/create-complete", trekControllerUnified.createCompleteTrek); // DISABLED - handled in app.js
//router.put("/update-complete/:id", validateLimitedTrekUpdate, trekControllerUnified.updateCompleteTrek);

// Limited validation middleware for trek updates (only captain_id)


// Dashboard analytics
router.get("/review_dashboard", adminReviewController.getAdminReviewDashboard);

// All reviews
router.get("/review_list", adminReviewController.getAllReviewsForAdmin);

// Critical queue
router.get("/review_critical-queue", adminReviewController.getCriticalQueue);


//router.put("/:id", validateLimitedTrekUpdate, trekController.updateTrek);
router.delete("/:id", trekController.deleteTrek);
router.patch("/:id/status", trekController.toggleTrekStatus);
router.get("/:id/batches", trekController.getBatches);



module.exports = router;
