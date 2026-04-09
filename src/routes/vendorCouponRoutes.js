const express = require('express');
const router = express.Router();
const vendorCouponController = require('../controllers/vendorCouponController');

// Vendor Coupon Pool Management
router.get('/pool/:vendorId', vendorCouponController.getVendorCouponPool);
router.post('/pool/allocate', vendorCouponController.allocateCouponsToVendor);

// Coupon Assignment to TBR
router.post('/assign', vendorCouponController.assignCouponToTBR);
router.get('/assignments/:vendorId', vendorCouponController.getVendorAssignments);
router.get('/tbr/:tbr', vendorCouponController.getAssignmentByTBR);

// Assignment Management
router.patch('/assignments/:assignmentId/cancel', vendorCouponController.cancelAssignment);
router.patch('/assignments/:assignmentId/reassign', vendorCouponController.reassignCoupon);

// History
router.get('/assignments/:assignmentId/history', vendorCouponController.getAssignmentHistory);

module.exports = router;
