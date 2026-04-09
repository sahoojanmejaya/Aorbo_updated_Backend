const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');

// Routes
router.get('/', couponController.getAllCoupons);
router.post('/', couponController.createCoupon);
router.put('/:id', couponController.updateCoupon);
router.patch('/:id/status', couponController.toggleStatus);
router.delete('/:id', couponController.deleteCoupon);

module.exports = router;
