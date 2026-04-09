const express = require("express");
const router = express.Router();
const { getAllBadges, getTrekBadge, getMyTrekBadges } = require("../../controllers/vendor/badgeController");

// All routes are read-only — vendors can view badges but not create/edit/delete them
// Auth is applied at the vendor index level (router.use(authMiddleware))

// GET /api/vendor/badges/my-treks — badges assigned to all of the vendor's treks
router.get("/my-treks", getMyTrekBadges);

// GET /api/vendor/badges/trek/:trekId — badge for a specific vendor trek
router.get("/trek/:trekId", getTrekBadge);

// GET /api/vendor/badges — all active badges reference list
router.get("/", getAllBadges);

module.exports = router;
