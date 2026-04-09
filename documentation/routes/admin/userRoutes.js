const express = require("express");
const router = express.Router();
const customerController = require("../../controllers/admin/customerController");

// Get all users/customers (with pagination, search, filters)
router.get("/", customerController.getCustomersSummary);

// Bulk update customer status
router.patch("/status", customerController.updateCustomerStatusBulk);

// Get customer profile and travelers
router.get("/:id/profile", customerController.getCustomerProfileAndTravelers);

// Get customer booking history
router.get("/:id/bookings-history", customerController.getCustomerBookingHistory);

// Get customer support tickets
router.get("/:id/support-tickets", customerController.getCustomerSupportTickets);

// Review routes - specific routes before generic
router.put("/:id/reviews/:reviewId/toggle-hide", customerController.toggleReviewHide);
router.delete("/:id/reviews/:reviewId", customerController.deleteReview);
router.get("/:id/reviews", customerController.getCustomerReviews);

// Analytics route
router.get("/:id/analytics", customerController.getCustomerAnalytics);

module.exports = router;


