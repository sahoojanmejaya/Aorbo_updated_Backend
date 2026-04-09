const express = require("express");
const router = express.Router();
const activityController = require("../../controllers/admin/activityController");
const authMiddleware = require("../../middleware/authMiddleware");

// All routes require authentication
router.use(authMiddleware);

// Admin activity routes
router.get("/", activityController.getAllActivities);
router.get("/search", activityController.searchActivities);
router.get("/categories", activityController.getCategories);
router.get("/categories/search", activityController.searchCategories);
router.get("/:id", activityController.getActivityById);
router.post("/", activityController.createActivity);
router.put("/:id", activityController.updateActivity);
router.delete("/:id", activityController.deleteActivity);
router.patch("/:id/toggle-status", activityController.toggleActivityStatus);

module.exports = router;
