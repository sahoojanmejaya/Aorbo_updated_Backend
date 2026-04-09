const express = require("express");
const router = express.Router();
const boardingPointController = require("../../controllers/admin/boardingPointController");
const authMiddleware = require("../../middleware/authMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all boarding points
router.get("/", boardingPointController.getBoardingPoints);

// Get boarding points by city
router.get("/city/:cityId", boardingPointController.getBoardingPointsByCity);

// Create boarding point
router.post("/", boardingPointController.createBoardingPoint);

// Update boarding point
router.put("/:id", boardingPointController.updateBoardingPoint);

// Delete boarding point
router.delete("/:id", boardingPointController.deleteBoardingPoint);

module.exports = router;
