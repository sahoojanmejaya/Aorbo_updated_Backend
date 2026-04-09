const express = require("express");
const router = express.Router();
const cityController = require("../../controllers/v1/cityController");

// Get all cities
router.get("/", cityController.getAllCities);

// Get popular cities
router.get("/popular", cityController.getPopularCities);

// Get cities by state
router.get("/state/:stateId", cityController.getCitiesByState);

// Get city by ID
router.get("/:id", cityController.getCityById);

module.exports = router;
