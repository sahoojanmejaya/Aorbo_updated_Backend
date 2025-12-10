const express = require("express");
const router = express.Router();
const stateController = require("../../controllers/vendor/stateController");
const authMiddleware = require("../../middleware/authMiddleware");

// All routes require authentication
router.use(authMiddleware);

// Vendor state routes
router.get("/", stateController.getAllStates);
router.post("/", stateController.createState);
router.get("/search", stateController.searchStates);
router.get("/validate", stateController.validateStateName);
router.get("/popular", stateController.getPopularStates);
router.get("/region/:region", stateController.getStatesByRegion);
router.get("/:id", stateController.getStateById);

module.exports = router;
