const express = require("express");
const router = express.Router();
const cancellationPolicyController = require("../../controllers/admin/cancellationPolicyController");

// Get all cancellation policies with pagination and filtering
router.get("/", cancellationPolicyController.getAllCancellationPolicies);

// Get active cancellation policies (for dropdowns)
router.get(
    "/active",
    cancellationPolicyController.getActiveCancellationPolicies
);

// Get cancellation policy by ID
router.get("/:id", cancellationPolicyController.getCancellationPolicyById);

// Create new cancellation policy
router.post("/", cancellationPolicyController.createCancellationPolicy);

// Update cancellation policy
router.put("/:id", cancellationPolicyController.updateCancellationPolicy);

// Delete cancellation policy
router.delete("/:id", cancellationPolicyController.deleteCancellationPolicy);

// Toggle cancellation policy status
router.patch(
    "/:id/toggle",
    cancellationPolicyController.toggleCancellationPolicyStatus
);

// Bulk update sort order
router.patch(
    "/sort-order",
    cancellationPolicyController.updateCancellationPolicySortOrder
);

module.exports = router;
