const express = require("express");
const router = express.Router();
const { getAllBadges, getBadgeCategories, getTrekBadge } = require("../../controllers/v1/badgeController");

// All badge endpoints are public (read-only, no customer PII involved)

// GET /api/v1/badges/categories — must be before /:id to avoid route shadowing
router.get("/categories", getBadgeCategories);

// GET /api/v1/badges/trek/:trekId — badge assigned to a specific trek
router.get("/trek/:trekId", getTrekBadge);

// GET /api/v1/badges — all active badges (optional ?category= filter)
router.get("/", getAllBadges);

module.exports = router;
