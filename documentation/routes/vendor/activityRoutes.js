const express = require("express");
const router = express.Router();
const activityController = require("../../controllers/vendor/activityController");
const authMiddleware = require("../../middleware/authMiddleware");

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Get all activities (popular ones first)
router.get("/", activityController.getAllActivities);

// Search activities
router.get("/search", activityController.searchActivities);

// Create new activity
router.post("/", activityController.createActivity);

// Create new activity category
router.post("/categories", activityController.createCategory);

// Get activity categories
router.get("/categories", activityController.getCategories);

module.exports = router;
