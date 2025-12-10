const express = require("express");
const router = express.Router();
const couponController = require("../../controllers/vendor/couponController");
const { body } = require("express-validator");

// Note: Authentication middleware is already applied at the vendor level

// Validation middleware for creating coupons
const createCouponValidation = [
    body('title')
        .notEmpty()
        .withMessage('Coupon title is required')
        .isLength({ min: 3, max: 100 })
        .withMessage('Coupon title must be between 3 and 100 characters'),
    
    body('code')
        .notEmpty()
        .withMessage('Coupon code is required')
        .isLength({ min: 3, max: 20 })
        .withMessage('Coupon code must be between 3 and 20 characters')
        .matches(/^[A-Z0-9]+$/)
        .withMessage('Coupon code must contain only uppercase letters and numbers'),
    
    body('description')
        .notEmpty()
        .withMessage('Description is required')
        .isLength({ min: 5, max: 500 })
        .withMessage('Description must be between 5 and 500 characters'),
    
    body('discount_type')
        .notEmpty()
        .withMessage('Discount type is required')
        .isIn(['fixed', 'percentage'])
        .withMessage('Please select either "Fixed Amount" or "Percentage" discount type'),
    
    body('discount_value')
        .notEmpty()
        .withMessage('Discount value is required')
        .isFloat({ min: 0.01 })
        .withMessage('Discount value must be greater than 0'),
    
    body('valid_from')
        .isISO8601()
        .withMessage('Valid from date must be a valid ISO 8601 date')
        .custom((value) => {
            const date = new Date(value);
            const now = new Date();
            if (date < now) {
                throw new Error('Valid from date cannot be in the past');
            }
            return true;
        }),
    
    body('valid_until')
        .isISO8601()
        .withMessage('Valid until date must be a valid ISO 8601 date')
        .custom((value, { req }) => {
            const validUntil = new Date(value);
            const validFrom = new Date(req.body.valid_from);
            if (validUntil <= validFrom) {
                throw new Error('Valid until date must be after valid from date');
            }
            return true;
        }),
    
    body('terms_and_conditions')
        .notEmpty()
        .withMessage('Terms and conditions are required')
        .isLength({ min: 10, max: 1000 })
        .withMessage('Terms and conditions must be between 10 and 1000 characters')
];

// Vendor coupon routes
router.get("/", couponController.getVendorCoupons); // For authenticated user
router.get("/trek/:trekId", couponController.getCouponsByTrek); // For specific trek ID
router.get("/vendor/:vendorId", couponController.getVendorCoupons); // For specific vendor ID
router.get("/:id", couponController.getVendorCouponById); // For authenticated user
router.get("/vendor/:vendorId/:id", couponController.getVendorCouponById); // For specific vendor ID
router.post("/", createCouponValidation, couponController.addCoupon);
router.put("/:id", createCouponValidation, couponController.updateCoupon);
router.delete("/:id", couponController.deleteCoupon);
router.post("/validate", couponController.validateCoupon);

module.exports = router;
