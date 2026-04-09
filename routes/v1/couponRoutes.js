const express = require("express");
const router = express.Router();
const couponController = require("../../controllers/v1/couponController");
const vendorCouponController = require("../../controllers/vendor/couponController");
const { authenticateCustomer } = require("../../middleware/customerAuthMiddleware");

// Public routes (for mobile app - no auth required)
router.get("/available", couponController.getAvailableCoupons);

// Protected routes (require customer authentication)
router.post("/validate", authenticateCustomer, couponController.validateCoupon);
router.post("/apply", authenticateCustomer, couponController.applyCoupon);
router.get("/customer", authenticateCustomer, couponController.getCustomerCoupons);

// Vendor-specific routes (require authentication)
router.get("/vendor/:vendorId", vendorCouponController.getVendorCoupons);
router.get("/trek/:trekId", vendorCouponController.getCouponsByTrek);

module.exports = router;
