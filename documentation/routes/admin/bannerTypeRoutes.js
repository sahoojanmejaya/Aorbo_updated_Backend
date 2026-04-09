const express = require("express");
const router = express.Router();
const bannerTypeController = require("../../controllers/admin/bannerTypeController");

// Get all banner types with pagination and filtering
router.get("/", bannerTypeController.getAllBannerTypes);

// Get active banner types (for dropdowns)
router.get("/active", bannerTypeController.getActiveBannerTypes);

// Get single banner type by ID
router.get("/:id", bannerTypeController.getBannerTypeById);

// Create new banner type
router.post("/", bannerTypeController.createBannerType);

// Update banner type
router.put("/:id", bannerTypeController.updateBannerType);

// Delete banner type (soft delete)
router.delete("/:id", bannerTypeController.deleteBannerType);

// Reorder banner types
router.post("/reorder", bannerTypeController.reorderBannerTypes);

module.exports = router;

