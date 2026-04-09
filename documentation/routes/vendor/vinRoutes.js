const express = require("express");
const router = express.Router();
const vendorController = require("../../controllers/vendor/vendorController");
//const authMiddleware = require("../../middleware/authMiddleware");
const faqController = require("../../controllers/admin/faqController");
const notificationController = require("../../controllers/admin/notificationController");
const commissionController= require("../../controllers/admin/commissionController"); 
const adminReviewController = require("../../controllers/admin/reviewController");
// Apply authentication middleware to all routes
//router.use(authMiddleware);

// Get all vendors (latest first / filters supported)
router.get("/", vendorController.getAllVendors);
router.get("/vendormangement/list", vendorController.getAllVendorMang);
router.get("/trek-summary/list", vendorController.getVendorCumulativeAnalysis );
router.get("/branch/list", vendorController.getBatchesByTrek );


router.get("/dashboard/counts/:vendor_id", vendorController.getVendorDashboardSummary);

router.get("/dashboard/maindashboard", vendorController.getAdminDashboardSummary);

router.get("/admin/vendor-performance", vendorController.getVendorPerformanceDashboard);
router.get("/admin/vendor-performance-list", vendorController.getVendorPerformanceList);


router.get("/admin/vendor-under-performers", vendorController.getVendorUnderperformersList);
router.get("/admin/vendor-top-performers", vendorController.getTopPerformersDashboard);
router.get("/admin/vendor-low-performers", vendorController.getLowPerformers);
router.get("/admin/get-performers", vendorController.getAttentionRequired);
router.get("/admin/get-overview/:vendorId",vendorController.getVendorOverview);
router.post("/notification_add_list", notificationController.addNotification); // trigger add
router.get("/get_notification_list/:vendorId", notificationController.getVendorNotifications); // list for vendor
router.post("/faq", faqController.createFAQ);
router.get("/faq", faqController.getAllFAQs);
router.get("/faq/:id", faqController.getFAQById);
router.put("/faq/:id", faqController.updateFAQ);
router.delete("/faq/:id", faqController.deleteFAQ);
router.post("/faq_category", faqController.createCategory);
router.get("/faq_category", faqController.getAllCategories);
router.put("/faq_category/:id", faqController.updateCategory);
router.delete("/faq_category/:id", faqController.deleteCategory);
router.post("/faqs/bulk-status", faqController.bulkUpdateFaqStatus);
router.post("/faqs/bulk-move", faqController.bulkMoveFaqCategory);
router.post("/faqs/bulk-delete", faqController.bulkDeleteFaqs);
router.post("/commission/create", commissionController.createCommission);
router.put("/commission/update/:id", commissionController.updateCommission);
router.delete("/commission/delete/:id", commissionController.deleteCommission);
router.get("/commission/list", commissionController.getAllCommissions);

router.get("/mail/sendMail", vendorController.sendMailZoho);

// Dashboard analytics
router.get("/review_dashboard", adminReviewController.getAdminReviewDashboard);
router.post("/review_update", adminReviewController.updateRatingStatus);
// All reviews
//router.get("/review_list", adminReviewController.getAllReviewsForAdmin);
// Critical queue
//router.get("/review_critical-queue", adminReviewController.getCriticalQueue);



// Search vendors
//router.get("/search", vendorController.searchVendors);

// Get vendor by ID
router.get("/:id", vendorController.getVendorById);

// Approve / Reject / Reverify vendor
router.post("/:id/action", vendorController.vendorAction);
router.post("/change-status", vendorController.changeVendorStatus);

router.get('/kyc/kyc-pending-list', vendorController.getKycPendingVendors);

router.put('/kyc/kyc-update-vendor', vendorController.updateVendorKycStatus);
router.get('/logs/audit-logs', vendorController.getAuditLog);


// Update vendor (KYC / profile)
router.put("/:id", vendorController.updateVendor);

// Get vendor activity / audit logs
router.get("/:id/activities", vendorController.getVendorActivities);

module.exports = router;
