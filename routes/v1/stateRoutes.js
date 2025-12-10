const express = require("express");
const router = express.Router();
const stateController = require("../../controllers/v1/stateController");

// Get all states
router.get("/", stateController.getAllStates);

// Search states
router.get("/search", stateController.searchStates);

// Get popular states
router.get("/popular", stateController.getPopularStates);

// Get states by region
router.get("/region/:region", stateController.getStatesByRegion);

// Get state by ID
router.get("/:id", stateController.getStateById);

module.exports = router;
