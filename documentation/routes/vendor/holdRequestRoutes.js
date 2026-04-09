const express = require("express");
const router = express.Router();
const holdRequestController = require("../../controllers/vendor/holdRequestController");
const authMiddleware = require("../../middleware/authMiddleware");

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Get all hold requests for vendor
router.get("/", holdRequestController.getVendorHoldRequests);

// Get hold request statistics
router.get("/stats", holdRequestController.getHoldRequestStats);

// Create a new hold request
router.post("/", holdRequestController.createHoldRequest);

// Get a specific hold request
router.get("/:id", holdRequestController.getHoldRequestById);

// Update a hold request (vendor can only update reason)
router.put("/:id", holdRequestController.updateHoldRequest);

// Cancel a hold request
router.delete("/:id", holdRequestController.cancelHoldRequest);

module.exports = router; 