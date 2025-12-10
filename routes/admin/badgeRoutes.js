const express = require("express");
const router = express.Router();
const badgeController = require("../../controllers/admin/badgeController");
const { validateBadge } = require("../../middleware/validationMiddleware");

// Get all badges with pagination and filtering
router.get("/", badgeController.getAllBadges);

// Get badge categories
router.get("/categories", badgeController.getBadgeCategories);

// Get badge by ID
router.get("/:id", badgeController.getBadgeById);

// Create new badge
router.post("/", validateBadge, badgeController.createBadge);

// Update badge
router.put("/:id", validateBadge, badgeController.updateBadge);

// Delete badge
router.delete("/:id", badgeController.deleteBadge);

// Bulk update badge sort order
router.put("/sort-order/bulk", badgeController.updateBadgeSortOrder);

module.exports = router;
