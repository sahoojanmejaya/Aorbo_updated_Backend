const express = require("express");
const router = express.Router();
const ratingController = require("../../controllers/admin/ratingController");

// GET /api/admin/ratings
router.get("/", ratingController.getAllRatings);

// GET /api/admin/ratings/stats
router.get("/stats", ratingController.getRatingStats);

// GET /api/admin/ratings/:id
router.get("/:id", ratingController.getRatingById);

// PATCH /api/admin/ratings/:id/approve
router.patch("/:id/approve", ratingController.approveRating);

// PATCH /api/admin/ratings/:id/reject
router.patch("/:id/reject", ratingController.rejectRating);

// PATCH /api/admin/ratings/:id/toggle-visibility
router.patch("/:id/toggle-visibility", ratingController.toggleRatingVisibility);

// PATCH /api/admin/ratings/:id/spam
router.patch("/:id/spam", ratingController.markRatingAsSpam);

// DELETE /api/admin/ratings/:id
router.delete("/:id", ratingController.deleteRating);

module.exports = router;
