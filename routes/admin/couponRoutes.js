const express = require("express");
const router = express.Router();
const couponController = require("../../controllers/admin/couponController");
const { body } = require("express-validator");

// NOTE: authMiddleware already applied by admin/index.js before mounting /coupons
// Do NOT apply it again here to avoid double-auth 500 errors

// Validation middleware for approval/rejection
const approvalValidation = [
    body('admin_notes')
        .optional()
        .isLength({ min: 0, max: 1000 })
        .withMessage('Admin notes must be less than 1000 characters')
];

const rejectionValidation = [
    body('admin_notes')
        .notEmpty()
        .withMessage('Admin notes are required when rejecting a coupon')
        .isLength({ min: 10, max: 1000 })
        .withMessage('Admin notes must be between 10 and 1000 characters')
];

const statusUpdateValidation = [
    body('status')
        .isIn(['active', 'inactive', 'expired'])
        .withMessage('Status must be active, inactive, or expired')
];

// Admin coupon routes
router.get("/", couponController.getAllCoupons);
router.get("/stats", couponController.getCouponStats);
router.get("/:id", couponController.getCouponById);
router.patch("/:id/approve", approvalValidation, couponController.approveCoupon);
router.patch("/:id/reject", rejectionValidation, couponController.rejectCoupon);
router.patch("/:id/status", statusUpdateValidation, couponController.updateCouponStatus);
router.delete("/:id", couponController.deleteCoupon);

module.exports = router;
