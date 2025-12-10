const express = require("express");
const router = express.Router();
const { getRefundSettings, updateRefundSettings, getRefundSettingsHistory } = require("../../controllers/admin/refundSettingsController");
const authMiddleware = require("../../middleware/authMiddleware");

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Get current refund settings
router.get("/", getRefundSettings);

// Update refund settings
router.put("/", updateRefundSettings);

// Get refund settings history
router.get("/history", getRefundSettingsHistory);

module.exports = router;







