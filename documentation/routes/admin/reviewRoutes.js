const express = require("express");
const router = express.Router();
const reviewController = require("../../controllers/admin/reviewController");
const authMiddleware = require("../../middleware/authMiddleware");

// Public routes (no authentication required)


router.get("/", reviewController.getAdminReviews);
router.get("/vendor_reviews", reviewController.getVendorDirectory);
router.get("/vendor_reviews/:vendorId", reviewController.getVendorTrekReviews);
module.exports = router;

