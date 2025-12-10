const express = require("express");
const router = express.Router();
const bannerItemController = require("../../controllers/admin/bannerItemController");
const { uploadBannerItemImages } = require("../../utils/bannerItemUpload");
const authMiddleware = require("../../middleware/authMiddleware");

// Using the proper multer configuration from bannerItemUpload.js

// Public API: Get all active banner items (No authentication required)
router.get("/public", bannerItemController.getPublicBannerItems);

// Get all banner items with pagination and filtering
router.get("/", bannerItemController.getAllBannerItems);

// Get single banner item by ID
router.get("/:id", bannerItemController.getBannerItemById);

// Create new banner item with file upload
router.post("/", uploadBannerItemImages, authMiddleware, bannerItemController.createBannerItem);

// Update banner item
router.put("/:id", bannerItemController.updateBannerItem);

// Delete banner item (soft delete)
router.delete("/:id", bannerItemController.deleteBannerItem);

// Reorder banner items
router.post("/reorder", bannerItemController.reorderBannerItems);

module.exports = router;
