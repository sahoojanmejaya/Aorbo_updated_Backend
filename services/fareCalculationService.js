const jwt = require("jsonwebtoken");
const { Trek, Batch, Coupon, TaxSetting, CommissionSetting, CouponUsage } = require("../models");
const { Op } = require("sequelize");
const logger = require("../utils/logger");

// Platform fee constants (must match Flutter BookingConstants)
const PLATFORM_FEE = 15;
const GST_RATE = 0.05;
const INSURANCE_FEE_PER_PERSON = 80;
const CANCELLATION_FEE_PER_PERSON = 90;

class FareCalculationService {
    /**
     * Calculate fare server-side with complete validation
     * NEVER trust client-provided amounts
     * @param {object} addons - { addInsurance: bool, addCancellationProtection: bool }
     */
    async calculateFare(batchId, travelerCount, couponCode = null, customerId = null, addons = {}) {
        try {
            // 1. Fetch and validate batch
            const batch = await Batch.findOne({
                where: { 
                    id: batchId,
                    status: "active"
                },
                include: [{
                    model: Trek,
                    as: "trek",
                    where: {
                        status: "active",
                        approval_status: "approved",
                        visibility: true
                    }
                }]
            });

            if (!batch) {
                throw new Error("Batch not found or inactive");
            }

            if (!batch.trek) {
                throw new Error("Trek not found or not approved");
            }

            // 2. Validate slot availability
            const availableSlots = batch.available_slots || 
                (batch.capacity - (batch.booked_slots || 0));
            
            if (availableSlots < travelerCount) {
                throw new Error(`Only ${availableSlots} slots available`);
            }

            // 3. Get base price from database (NEVER from client)
            const basePrice = parseFloat(batch.trek.base_price);
            const baseTotalAmount = basePrice * travelerCount;

            // 4. Validate and apply coupon (if provided)
            let discount = 0;
            let couponId = null;
            let couponDetails = null;

            if (couponCode) {
                const couponResult = await this.validateAndApplyCoupon(
                    couponCode,
                    batch.trek.id,
                    batch.trek.vendor_id,
                    baseTotalAmount,
                    customerId
                );
                
                discount = couponResult.discount;
                couponId = couponResult.couponId;
                couponDetails = couponResult.details;
            }

            // 5. Calculate amount after discount
            const amountAfterDiscount = baseTotalAmount - discount;

            // 6. Calculate taxes (from database)
            const taxes = await this.calculateTaxes(amountAfterDiscount, batch.trek.vendor_id);

            // 7. Calculate platform commission (hidden from customer)
            const commission = await this.calculateCommission(
                amountAfterDiscount,
                batch.trek.vendor_id
            );

            // 8. Calculate GST on amount after discount (5%)
            const gstAmount = Math.round(amountAfterDiscount * GST_RATE * 100) / 100;

            // 9. Calculate platform and optional add-on fees
            const platformFee = PLATFORM_FEE;
            const insuranceFee = addons.addInsurance ? (INSURANCE_FEE_PER_PERSON * travelerCount) : 0;
            const cancellationFee = addons.addCancellationProtection ? (CANCELLATION_FEE_PER_PERSON * travelerCount) : 0;

            // 10. Calculate final amount (DB taxes + GST + platform fee + add-ons)
            const finalAmount = amountAfterDiscount + taxes.totalTax + gstAmount + platformFee + insuranceFee + cancellationFee;

            // 11. Generate secure fare token (expires in 5 minutes)
            const fareToken = this.generateFareToken({
                batchId,
                trekId: batch.trek.id,
                vendorId: batch.trek.vendor_id,
                travelerCount,
                basePrice,
                baseTotalAmount,
                discount,
                couponId,
                taxes: taxes.breakdown,
                totalTax: taxes.totalTax,
                gstAmount,
                platformFee,
                insuranceFee,
                cancellationFee,
                commission: commission.amount,
                commissionPercentage: commission.percentage,
                finalAmount,
                calculatedAt: new Date().toISOString()
            });

            return {
                success: true,
                fareToken,
                breakdown: {
                    base_price: basePrice,
                    traveler_count: travelerCount,
                    base_total: baseTotalAmount,
                    discount: discount,
                    coupon_code: couponCode || null,
                    amount_after_discount: amountAfterDiscount,
                    taxes: taxes.breakdown,
                    total_tax: taxes.totalTax,
                    gst: gstAmount,
                    platform_fee: platformFee,
                    insurance_fee: insuranceFee,
                    cancellation_fee: cancellationFee,
                    final_amount: finalAmount,
                    // Commission hidden from customer
                },
                coupon_details: couponDetails,
                expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
            };
        } catch (error) {
            logger.error("fare", "Fare calculation failed", {
                error: error.message,
                batchId,
                travelerCount,
                couponCode
            });
            throw error;
        }
    }

    /**
     * Validate coupon and calculate discount
     */
    async validateAndApplyCoupon(couponCode, trekId, vendorId, amount, customerId) {
        const coupon = await Coupon.findOne({
            where: {
                code: couponCode,
                status: "active",
                approval_status: "approved",
                valid_from: { [Op.lte]: new Date() },
                valid_until: { [Op.gte]: new Date() }
            }
        });

        if (!coupon) {
            throw new Error("Invalid or expired coupon");
        }

        // Check usage limits
        if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
            throw new Error("Coupon usage limit exceeded");
        }

        // Check per-user limit
        if (customerId && coupon.per_user_limit) {
            const userUsageCount = await CouponUsage.count({
                where: {
                    coupon_id: coupon.id,
                    customer_id: customerId
                }
            });

            if (userUsageCount >= coupon.per_user_limit) {
                throw new Error("You have already used this coupon");
            }
        }

        // Check minimum amount
        if (coupon.min_amount && amount < parseFloat(coupon.min_amount)) {
            throw new Error(`Minimum amount ₹${coupon.min_amount} required`);
        }

        // Check vendor restrictions (SPECIAL scope)
        if (coupon.scope === "SPECIAL" && coupon.target_vendor_ids) {
            const targetVendors = JSON.parse(coupon.target_vendor_ids);
            if (!targetVendors.includes(vendorId)) {
                throw new Error("Coupon not applicable for this trek");
            }
        }

        // Check if coupon is vendor-specific
        if (coupon.vendor_id && coupon.vendor_id !== vendorId) {
            throw new Error("Coupon not applicable for this vendor");
        }

        // Calculate discount
        let discount = 0;
        if (coupon.discount_type === "fixed") {
            discount = parseFloat(coupon.discount_value);
        } else if (coupon.discount_type === "percentage") {
            discount = (amount * parseFloat(coupon.discount_value)) / 100;
            
            // Apply max discount cap
            if (coupon.max_discount_amount) {
                discount = Math.min(discount, parseFloat(coupon.max_discount_amount));
            }
        }

        return {
            discount,
            couponId: coupon.id,
            details: {
                code: coupon.code,
                title: coupon.title,
                discount_type: coupon.discount_type,
                discount_value: coupon.discount_value
            }
        };
    }

    /**
     * Calculate taxes from database settings
     */
    async calculateTaxes(amount, vendorId) {
        const taxSettings = await TaxSetting.findAll({
            where: {
                status: "active",
                [Op.or]: [
                    { vendor_id: vendorId },
                    { vendor_id: null } // Platform-wide taxes
                ]
            }
        });

        let totalTax = 0;
        const breakdown = [];

        for (const tax of taxSettings) {
            let taxAmount = 0;
            if (tax.tax_type === "percentage") {
                taxAmount = (amount * parseFloat(tax.tax_value)) / 100;
            } else if (tax.tax_type === "fixed") {
                taxAmount = parseFloat(tax.tax_value);
            }

            totalTax += taxAmount;
            breakdown.push({
                name: tax.tax_name,
                type: tax.tax_type,
                value: tax.tax_value,
                amount: taxAmount
            });
        }

        return { totalTax, breakdown };
    }

    /**
     * Calculate platform commission
     */
    async calculateCommission(amount, vendorId) {
        const commissionSetting = await CommissionSetting.findOne({
            where: {
                vendor_id: vendorId,
                status: "active",
                effective_from: { [Op.lte]: new Date() }
            },
            order: [["effective_from", "DESC"]]
        });

        if (!commissionSetting) {
            // Default commission if not set
            return { amount: 0, percentage: 0 };
        }

        let commissionAmount = 0;
        if (commissionSetting.commission_type === "percentage") {
            commissionAmount = (amount * parseFloat(commissionSetting.commission_value)) / 100;
        } else if (commissionSetting.commission_type === "fixed") {
            commissionAmount = parseFloat(commissionSetting.commission_value);
        }

        return {
            amount: commissionAmount,
            percentage: commissionSetting.commission_value,
            type: commissionSetting.commission_type
        };
    }

    /**
     * Generate secure fare token (JWT)
     */
    generateFareToken(fareData) {
        return jwt.sign(
            fareData,
            process.env.FARE_TOKEN_SECRET || process.env.JWT_SECRET,
            { expiresIn: "5m" }
        );
    }

    /**
     * Verify and decode fare token
     */
    verifyFareToken(token) {
        try {
            const decoded = jwt.verify(
                token,
                process.env.FARE_TOKEN_SECRET || process.env.JWT_SECRET
            );
            return { valid: true, data: decoded };
        } catch (error) {
            if (error.name === "TokenExpiredError") {
                throw new Error("Fare calculation expired. Please recalculate.");
            }
            throw new Error("Invalid fare token");
        }
    }

    /**
     * Recalculate and verify fare matches token
     * Used during payment verification
     */
    async verifyFareIntegrity(fareToken, batchId, travelerCount) {
        const tokenData = this.verifyFareToken(fareToken);
        
        // Recalculate fare with current database values
        const freshCalculation = await this.calculateFare(
            batchId,
            travelerCount,
            null, // Don't reapply coupon
            null
        );

        // Compare base amounts (excluding coupon)
        if (Math.abs(tokenData.data.baseTotalAmount - freshCalculation.breakdown.base_total) > 0.01) {
            throw new Error("Fare integrity check failed. Price may have changed.");
        }

        return tokenData.data;
    }
}

module.exports = new FareCalculationService();
