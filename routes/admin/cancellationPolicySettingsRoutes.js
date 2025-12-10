const express = require("express");
const router = express.Router();
const cancellationPolicySettingsController = require("../../controllers/admin/cancellationPolicySettingsController");

// Get all cancellation policy settings
router.get("/", cancellationPolicySettingsController.getAllPolicySettings);

// Get policy settings by type (flexible or standard)
router.get("/:policyType", cancellationPolicySettingsController.getPolicySettingsByType);

// Update policy settings by type
router.put("/:policyType", cancellationPolicySettingsController.updatePolicySettings);

// Get policy settings history
router.get("/history/records", cancellationPolicySettingsController.getPolicySettingsHistory);

module.exports = router;
