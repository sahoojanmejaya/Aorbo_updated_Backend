const express = require("express");
const router = express.Router();
const trekController = require("../../controllers/v1/trekController");

// Public routes (for mobile app - no auth required)
router.get("/", trekController.getAllTreks); // Get all active treks
router.get("/:id", trekController.getTrekById); // Get single trek details
router.get("/:id/batches", trekController.getTrekBatches); // Get trek batches
router.get("/:id/reviews", trekController.getTrekReviews); // Get trek reviews
router.get("/:id/ratings", trekController.getTrekRatings); // Get trek ratings

module.exports = router;
