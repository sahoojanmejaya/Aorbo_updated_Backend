const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");
const reviewController = require("../../controllers/vendor/reviewController");

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get vendor reviews
router.get("/", reviewController.getVendorReviews);

// Get vendor ratings (for dynamic table)
router.get("/ratings", reviewController.getVendorRatings);

// Get vendor ratings without pagination (for review and feedback page)
router.get("/ratings/unlimited", reviewController.getVendorRatingsUnlimited);

// Get vendor rating analytics
router.get("/analytics", reviewController.getVendorRatingAnalytics);

// Get rating categories
router.get("/categories", reviewController.getRatingCategories);

// Get review by ID
router.get("/:id", reviewController.getReviewById);

// Update review status
router.patch("/:id/status", reviewController.updateReviewStatus);

// Report rating to admin
router.post("/:id/report", reviewController.reportRating);

module.exports = router;
