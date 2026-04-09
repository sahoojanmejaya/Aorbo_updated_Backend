const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");
const { 
    requireAdmin, 
    handleValidationErrors,
    auditLogger 
} = require("../../middleware/securityMiddleware");
const {
    getPendingTreks,
    reviewTrek,
    reviewTrekValidation,
    getAllTreks,
    updateCriticalFields,
    toggleVisibility
} = require("../../controllers/admin/trekApprovalController");

// All routes require admin authentication
router.use(authMiddleware);
router.use(requireAdmin);

/**
 * Get pending treks for approval
 * GET /admin/treks/pending
 */
router.get("/pending", getPendingTreks);

/**
 * Get all treks with filters
 * GET /admin/treks
 */
router.get("/", getAllTreks);

/**
 * Review trek (approve/reject)
 * POST /admin/treks/:id/review
 */
router.post(
    "/:id/review",
    reviewTrekValidation,
    handleValidationErrors,
    auditLogger("trek_reviewed", "trek"),
    reviewTrek
);

/**
 * Update trek critical fields
 * PUT /admin/treks/:id/critical-fields
 */
router.put(
    "/:id/critical-fields",
    auditLogger("trek_critical_fields_updated", "trek"),
    updateCriticalFields
);

/**
 * Toggle trek visibility
 * PATCH /admin/treks/:id/visibility
 */
router.patch(
    "/:id/visibility",
    auditLogger("trek_visibility_changed", "trek"),
    toggleVisibility
);

module.exports = router;
