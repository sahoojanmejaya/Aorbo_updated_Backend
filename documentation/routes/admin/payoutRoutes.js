const express = require("express");
const router = express.Router();
const payoutController = require("../../controllers/admin/payoutController");

// Get all payout batches
router.get("/", payoutController.getAllPayouts);

// Get payout statistics
router.get("/stats", payoutController.getPayoutStats);

// Get specific payout batch
router.get("/:id", payoutController.getPayoutById);

// Run payout cycle
router.post("/run-cycle", payoutController.runPayoutCycle);

module.exports = router;
