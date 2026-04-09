const express = require('express');
const router = express.Router();
const couponAuditController = require('../../controllers/vendor/couponAuditController');

// Get audit logs for the authenticated vendor
router.get('/', couponAuditController.getVendorAuditLogs);

// Get audit logs for a specific coupon
router.get('/coupon/:couponId', couponAuditController.getCouponAuditLogs);

// Get available actions for filtering
router.get('/actions', couponAuditController.getAvailableActions);

module.exports = router;
