const express = require("express");
const router = express.Router();
const exclusionController = require("../../controllers/vendor/exclusionController");
const authMiddleware = require("../../middleware/authMiddleware");

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Get all exclusions (popular ones first)
router.get("/", exclusionController.getAllExclusions);

// Search exclusions
router.get("/search", exclusionController.searchExclusions);

// Create new exclusion
router.post("/", exclusionController.createExclusion);

// Get exclusion by ID
router.get("/:id", exclusionController.getExclusionById);

// Update exclusion
router.put("/:id", exclusionController.updateExclusion);

// Delete exclusion (soft delete)
router.delete("/:id", exclusionController.deleteExclusion);

module.exports = router; 