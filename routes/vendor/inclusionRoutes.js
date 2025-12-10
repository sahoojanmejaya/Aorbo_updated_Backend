const express = require("express");
const router = express.Router();
const inclusionController = require("../../controllers/vendor/inclusionController");
const authMiddleware = require("../../middleware/authMiddleware");

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Get all inclusions (popular ones first)
router.get("/", inclusionController.getAllInclusions);

// Search inclusions
router.get("/search", inclusionController.searchInclusions);

// Create new inclusion
router.post("/", inclusionController.createInclusion);

// Get inclusion by ID
router.get("/:id", inclusionController.getInclusionById);

// Update inclusion
router.put("/:id", inclusionController.updateInclusion);

// Delete inclusion (soft delete)
router.delete("/:id", inclusionController.deleteInclusion);

module.exports = router; 