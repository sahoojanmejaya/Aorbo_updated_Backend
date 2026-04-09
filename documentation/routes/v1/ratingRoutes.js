const express = require("express");
const router = express.Router();
const ratingController = require("../../controllers/v1/ratingController");
const { authenticateCustomer } = require("../../middleware/customerAuthMiddleware");

// Mobile: Get all ratings with customer details (Public endpoint - no authentication required)
router.get("/", ratingController.getAllRatings);

// Mobile: Get all ratings without pagination (for review and feedback page)
router.get("/all", ratingController.getAllRatingsUnlimited);

// Mobile: Submit rating and review (Authentication required)
router.post("/", authenticateCustomer, ratingController.submitRating);

// Mobile: Get own ratings (identity from JWT, not URL param)
router.get("/customer/me", authenticateCustomer, ratingController.getCustomerRatings);

// Mobile: Update rating (Authentication required)
router.put("/:id", authenticateCustomer, ratingController.updateRating);

// Mobile: Delete rating (Authentication required)
router.delete("/:id", authenticateCustomer, ratingController.deleteRating);

module.exports = router;

