const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");
const { 
    requireAdmin, 
    handleValidationErrors,
    auditLogger 
} = require("../../middleware/securityMiddleware");
const {
    getEligibleBookings,
    triggerSettlement,
    triggerSettlementValidation,
    getSettlementHistory,
    getVendorWallet
} = require("../../controllers/admin/settlementController");

// All routes require admin authentication
router.use(authMiddleware);
router.use(requireAdmin);

/**
 * Get bookings eligible for settlement
 * GET /admin/settlements/eligible
 */
router.get("/eligible", getEligibleBookings);

/**
 * Trigger settlement for selected bookings
 * POST /admin/settlements/trigger
 */
router.post(
    "/trigger",
    triggerSettlementValidation,
    handleValidationErrors,
    auditLogger("settlement_triggered", "settlement"),
    triggerSettlement
);

/**
 * Get settlement history
 * GET /admin/settlements/history
 */
router.get("/history", getSettlementHistory);

/**
 * Get vendor wallet details
 * GET /admin/settlements/vendor/:vendorId/wallet
 */
router.get("/vendor/:vendorId/wallet", getVendorWallet);

module.exports = router;
