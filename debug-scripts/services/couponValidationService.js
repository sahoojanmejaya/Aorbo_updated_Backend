const { Coupon, CouponRedemption } = require('../models');
const logger = require('../utils/logger');

class CouponValidationService {
    /**
     * Validate a coupon code for a given customer and order.
     *
     * @param {string} couponCode
     * @param {number} customerId
     * @param {number} orderAmount
     * @param {number|null} trekId
     * @returns {{ valid: boolean, coupon?, discountAmount?, error? }}
     */
    async validateCoupon(couponCode, customerId, orderAmount, trekId = null) {
        try {
            const coupon = await Coupon.findOne({
                where: {
                    code: couponCode,
                    status: 'active',
                    approval_status: 'approved',
                },
            });

            if (!coupon) {
                return { valid: false, error: 'Coupon not found or inactive' };
            }

            const now = new Date();

            if (coupon.valid_from && new Date(coupon.valid_from) > now) {
                return { valid: false, error: 'Coupon not yet valid' };
            }

            if (coupon.valid_until && new Date(coupon.valid_until) < now) {
                return { valid: false, error: 'Coupon has expired' };
            }

            if (coupon.min_order_value && orderAmount < coupon.min_order_value) {
                return { valid: false, error: `Minimum order value is ₹${coupon.min_order_value}` };
            }

            if (coupon.usage_limit) {
                const usageCount = await CouponRedemption.count({ where: { coupon_id: coupon.id } });
                if (usageCount >= coupon.usage_limit) {
                    return { valid: false, error: 'Coupon usage limit reached' };
                }
            }

            if (coupon.per_user_limit) {
                const userUsageCount = await CouponRedemption.count({
                    where: { coupon_id: coupon.id, customer_id: customerId },
                });
                if (userUsageCount >= coupon.per_user_limit) {
                    return { valid: false, error: 'You have already used this coupon' };
                }
            }

            if (coupon.applicable_treks && trekId) {
                const applicableTreks = JSON.parse(coupon.applicable_treks);
                if (!applicableTreks.includes(trekId)) {
                    return { valid: false, error: 'Coupon not applicable for this trek' };
                }
            }

            let discountAmount = (orderAmount * coupon.discount_percentage) / 100;
            if (coupon.max_discount_amount && discountAmount > coupon.max_discount_amount) {
                discountAmount = coupon.max_discount_amount;
            }

            return { valid: true, coupon, discountAmount };
        } catch (error) {
            logger.error('coupon-validation', 'Validation failed', {
                couponCode,
                customerId,
                error: error.message,
            });
            return { valid: false, error: 'Failed to validate coupon' };
        }
    }

    /**
     * Record coupon redemption and increment usage_count on the coupon.
     */
    async recordUsage(couponId, customerId, bookingId, discountAmount) {
        try {
            await CouponRedemption.create({
                coupon_id: couponId,
                customer_id: customerId,
                booking_id: bookingId,
                discount_amount: discountAmount,
                redeemed_at: new Date(),
            });

            const coupon = await Coupon.findByPk(couponId);
            if (coupon) {
                await coupon.increment('usage_count');
            }

            logger.info('coupon-validation', 'Coupon usage recorded', {
                couponId,
                customerId,
                bookingId,
                discountAmount,
            });
        } catch (error) {
            logger.error('coupon-validation', 'Failed to record usage', {
                couponId,
                customerId,
                error: error.message,
            });
            throw error;
        }
    }
}

module.exports = new CouponValidationService();
