const express = require("express");
const router = express.Router();
const destinationController = require("../../controllers/vendor/destinationController");
const authMiddleware = require("../../middleware/authMiddleware");

// All routes require authentication
router.use(authMiddleware);

// Get all destinations (for dropdowns)
router.get("/", destinationController.getAllDestinations);

// Search destinations for autocomplete
router.get("/search", destinationController.searchDestinations);

// Get popular destinations
router.get("/popular", destinationController.getPopularDestinations);

// Get destination by ID
router.get("/:id", destinationController.getDestinationById);

// Create new destination
router.post("/", destinationController.createDestination);

// Update destination
router.put("/:id", destinationController.updateDestination);

// Delete destination
router.delete("/:id", destinationController.deleteDestination);

// Toggle destination popularity
router.patch("/:id/toggle-popularity", destinationController.togglePopularity);

module.exports = router;
