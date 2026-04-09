const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");
const { 
    requireRole, 
    handleValidationErrors,
    protectCriticalFields,
    enforceVendorIsolation,
    auditLogger 
} = require("../../middleware/securityMiddleware");
const {
    createTrek,
    createTrekValidation,
    getMyTreks,
    updateTrek,
    requestModification,
    getMyBookings
} = require("../../controllers/vendor/restrictedTrekController");

// All routes require vendor authentication
router.use(authMiddleware);
router.use(requireRole("vendor"));
router.use(enforceVendorIsolation);

/**
 * Create trek (pending approval)
 * POST /vendor/treks
 */
router.post(
    "/",
    createTrekValidation,
    handleValidationErrors,
    auditLogger("trek_created", "trek"),
    createTrek
);

/**
 * Get vendor's treks
 * GET /vendor/treks
 */
router.get("/", getMyTreks);

/**
 * Update trek (non-critical fields only)
 * PUT /vendor/treks/:id
 */
router.put(
    "/:id",
    protectCriticalFields(["base_price", "difficulty", "max_capacity", "cancellation_policy_id"]),
    auditLogger("trek_updated", "trek"),
    updateTrek
);

/**
 * Request critical field modification
 * POST /vendor/treks/:id/request-modification
 */
router.post(
    "/:id/request-modification",
    auditLogger("trek_modification_requested", "trek"),
    requestModification
);

/**
 * Get vendor bookings (limited data)
 * GET /vendor/bookings
 */
router.get("/bookings", getMyBookings);

module.exports = router;
