const express = require("express");
const router = express.Router();
const destinationController = require("../../controllers/v1/destinationController");

// Get all destinations
router.get("/", destinationController.getAllDestinations);

// Get popular destinations
router.get("/popular", destinationController.getPopularDestinations);

// Get destinations by state
router.get("/state/:state", destinationController.getDestinationsByState);

// Get destination by ID
router.get("/:id", destinationController.getDestinationById);

module.exports = router;
