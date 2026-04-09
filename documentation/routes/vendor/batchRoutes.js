const express = require("express");
const router = express.Router();
const batchController = require("../../controllers/vendor/batchController");
const authMiddleware = require("../../middleware/authMiddleware");

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Get all vendor batches with filters for Trek Booking Records
router.get("/", batchController.getVendorBatches);

module.exports = router;
