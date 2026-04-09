const {
    Coupon,
    CouponAssignment,
    Customer,
    sequelize,
} = require("../../models");
const { Op } = require("sequelize");
const logger = require('../../utils/logger');

// Mobile: Get all active coupons available for customer
// Optionally pass ?vendor_id=X to filter by scope (PLATFORM, NORMAL for that vendor, SPECIAL targeting that vendor, INFLUENCER)
exports.getAvailableCoupons = async (req, res) => {
    try {
        const customer_id = req.customer.id; // Always from JWT
        const { vendor_id } = req.query;

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const baseWhere = {
            status: "active",
            approval_status: "approved",
            valid_from: { [Op.lte]: endOfToday },
            valid_until: { [Op.gte]: startOfToday },
            [Op.or]: [
                { max_uses: null },
                { current_uses: { [Op.lt]: sequelize.col("max_uses") } },
            ],
        };

        let scopeFilter;
        if (vendor_id) {
            // Get customer tier for PREMIUM coupon eligibility
            const customer = await Customer.findByPk(customer_id, { attributes: ['id', 'tier'] });
            const scopeConditions = [
                { scope: 'PLATFORM' },
                { scope: 'NORMAL', vendor_id: vendor_id },
                { scope: 'INFLUENCER' },
                {
                    scope: 'SPECIAL',
                    target_vendor_ids: { [Op.like]: `%${vendor_id}%` }
                },
            ];
            if (customer && customer.tier && ['GOLD', 'PLATINUM'].includes(customer.tier)) {
                scopeConditions.push({
                    scope: 'PREMIUM',
                    [Op.or]: [
                        { config: { [Op.like]: `%"tierTarget":"${customer.tier}"%` } },
                        { config: { [Op.like]: '%"tierTarget":"BOTH"%' } },
                    ]
                });
            }
            scopeFilter = { [Op.or]: scopeConditions };
        }
        // When no vendor_id is provided, return all eligible coupons (generic list screen)

        const coupons = await Coupon.findAll({
            where: scopeFilter ? { ...baseWhere, ...scopeFilter } : baseWhere,
            order: [["created_at", "DESC"]],
        });

        // Check which coupons are already used by this customer
        const customerCoupons = await CouponAssignment.findAll({
            where: { customer_id: customer_id },
            attributes: ["coupon_id"],
        });

        const usedCouponIds = new Set(customerCoupons.map((cc) => cc.coupon_id));

        const availableCoupons = coupons.filter((coupon) => !usedCouponIds.has(coupon.id));

        const transformedCoupons = availableCoupons.map((coupon) => ({
            id: coupon.id,
            title: coupon.title,
            color: coupon.color,
            code: coupon.code,
            description: coupon.description,
            scope: coupon.scope,
            discount_type: coupon.discount_type,
            discount_value: coupon.discount_value,
            min_amount: coupon.min_amount,
            max_discount_amount: coupon.max_discount_amount,
            valid_from: coupon.valid_from,
            valid_until: coupon.valid_until,
            current_uses: coupon.current_uses,
            max_uses: coupon.max_uses,
            is_used: false,
        }));

        res.json({
            success: true,
            data: transformedCoupons,
            count: transformedCoupons.length,
        });
    } catch (error) {
        logger.error("Error fetching available coupons:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch coupons",
            error: error.message,
        });
    }
};

// Mobile: Validate coupon code
// Optionally pass vendor_id in body to enforce scope-based eligibility
exports.validateCoupon = async (req, res) => {
    try {
        const { code, amount, vendor_id } = req.body;
        const customer_id = req.customer.id;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: "Coupon code is required",
            });
        }

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const coupon = await Coupon.findOne({
            where: {
                code: code.toUpperCase(),
                status: "active",
                approval_status: "approved",
                valid_from: { [Op.lte]: endOfToday },
                valid_until: { [Op.gte]: startOfToday },
            },
        });

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Invalid or expired coupon code",
            });
        }

        // Scope-based eligibility check when vendor context is provided
        if (vendor_id) {
            switch (coupon.scope) {
                case 'NORMAL':
                    if (String(coupon.vendor_id) !== String(vendor_id)) {
                        return res.status(400).json({
                            success: false,
                            message: "Coupon is not valid for this vendor",
                        });
                    }
                    break;
                case 'SPECIAL': {
                    let targetIds = [];
                    try {
                        targetIds = typeof coupon.target_vendor_ids === 'string'
                            ? JSON.parse(coupon.target_vendor_ids)
                            : (coupon.target_vendor_ids || []);
                    } catch (_) { /* ignore */ }
                    if (!targetIds.map(String).includes(String(vendor_id))) {
                        return res.status(400).json({
                            success: false,
                            message: "Coupon is not valid for this vendor",
                        });
                    }
                    break;
                }
                case 'PREMIUM': {
                    const customer = await Customer.findByPk(customer_id, { attributes: ['tier'] });
                    let config = {};
                    try { config = typeof coupon.config === 'string' ? JSON.parse(coupon.config) : (coupon.config || {}); } catch (_) { /* ignore */ }
                    const tier = customer && customer.tier;
                    if (config.tierTarget === 'GOLD' && tier !== 'GOLD') {
                        return res.status(400).json({ success: false, message: "Coupon requires Gold membership" });
                    }
                    if (config.tierTarget === 'PLATINUM' && tier !== 'PLATINUM') {
                        return res.status(400).json({ success: false, message: "Coupon requires Platinum membership" });
                    }
                    if (config.tierTarget === 'BOTH' && !['GOLD', 'PLATINUM'].includes(tier)) {
                        return res.status(400).json({ success: false, message: "Coupon requires Gold or Platinum membership" });
                    }
                    break;
                }
                // PLATFORM and INFLUENCER apply to all vendors — no restriction
                default:
                    break;
            }
        }

        // Check if customer has already used this coupon
        const customerCoupon = await CouponAssignment.findOne({
            where: { coupon_id: coupon.id, customer_id: customer_id },
        });
        if (customerCoupon) {
            return res.status(400).json({ success: false, message: "You have already used this coupon" });
        }

        // Check usage limits
        if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
            return res.status(400).json({ success: false, message: "This coupon has reached its usage limit" });
        }

        // Check minimum amount
        if (amount && coupon.min_amount && amount < coupon.min_amount) {
            return res.status(400).json({
                success: false,
                message: `Minimum order amount of ₹${coupon.min_amount} required`,
            });
        }

        // Calculate discount
        let discountAmount = 0;
        if (coupon.discount_type === "percentage") {
            discountAmount = (amount * coupon.discount_value) / 100;
            if (coupon.max_discount_amount) {
                discountAmount = Math.min(discountAmount, coupon.max_discount_amount);
            }
        } else {
            discountAmount = coupon.discount_value;
        }

        res.json({
            success: true,
            data: {
                id: coupon.id,
                title: coupon.title,
                color: coupon.color,
                code: coupon.code,
                description: coupon.description,
                scope: coupon.scope,
                discount_type: coupon.discount_type,
                discount_value: coupon.discount_value,
                discount_amount: discountAmount,
                min_amount: coupon.min_amount,
                max_discount_amount: coupon.max_discount_amount,
                valid_from: coupon.valid_from,
                valid_until: coupon.valid_until,
            },
        });
    } catch (error) {
        logger.error("Error validating coupon:", error);
        res.status(500).json({
            success: false,
            message: "Failed to validate coupon",
            error: error.message,
        });
    }
};

// Mobile: Apply coupon (mark as used)
exports.applyCoupon = async (req, res) => {
    // Start transaction
    const transaction = await sequelize.transaction();
    try {
        const { coupon_id, booking_id } = req.body;
        const customer_id = req.customer.id; // Extract from authenticated token

        if (!coupon_id) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: "Coupon ID is required",
            });
        }

        // Find the coupon with a lock to prevent concurrent usage issues
        const coupon = await Coupon.findByPk(coupon_id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!coupon) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: "Coupon not found",
            });
        }

        // Check if customer has already used this coupon
        const existingAssignment = await CouponAssignment.findOne({
            where: {
                coupon_id: coupon_id,
                customer_id: customer_id,
            },
            transaction
        });

        if (existingAssignment) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: "You have already used this coupon",
            });
        }

        // Check usage limit inside the transaction
        if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: "This coupon has reached its usage limit",
            });
        }

        const currentDate = new Date();
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        // Check if coupon is expired or inactive inside transaction
        if (coupon.status !== 'active' || coupon.approval_status !== 'approved' ||
            new Date(coupon.valid_from) > endOfToday || new Date(coupon.valid_until) < startOfToday) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: "This coupon is expired or invalid",
            });
        }

        // Create coupon assignment
        await CouponAssignment.create({
            coupon_id: coupon_id,
            customer_id: customer_id,
            booking_id: booking_id || null,
            used_at: new Date(),
        }, { transaction });

        // Increment coupon usage count
        await coupon.increment("current_uses", { by: 1, transaction });

        // Log the coupon application
        const CouponAuditService = require('../../services/couponAuditService');
        await CouponAuditService.logCouponApplication(
            coupon,
            booking_id,
            customer_id,
            null, // discountAmount - not calculated in this endpoint
            null, // originalAmount - not calculated in this endpoint
            null, // finalAmount - not calculated in this endpoint
            null, // trek_id - could be extracted from booking if needed
            null, // batch_id - could be extracted from booking if needed
            coupon.vendor_id,
            req
        );

        // Commit the transaction
        await transaction.commit();

        res.json({
            success: true,
            message: "Coupon applied successfully",
        });
    } catch (error) {
        logger.error("Error applying coupon:", error);
        res.status(500).json({
            success: false,
            message: "Failed to apply coupon",
            error: error.message,
        });
    }
};

// Mobile: Get customer's used coupons
exports.getCustomerCoupons = async (req, res) => {
    try {
        const customer_id = req.customer.id; // Extract from authenticated token
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const { count, rows: customerCoupons } =
            await CouponAssignment.findAndCountAll({
                where: { customer_id: customer_id },
                include: [
                    {
                        model: Coupon,
                        as: "coupon",
                        attributes: [
                            "id",
                            "title",
                            "color",
                            "code",
                            "description",
                            "discount_type",
                            "discount_value",
                            "valid_from",
                            "valid_until",
                        ],
                    },
                ],
                order: [["used_at", "DESC"]],
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

        const transformedCoupons = customerCoupons.map((cc) => ({
            id: cc.id,
            coupon: cc.coupon,
            used_at: cc.used_at,
            booking_id: cc.booking_id,
        }));

        res.json({
            success: true,
            data: transformedCoupons,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / limit),
                totalCount: count,
            },
        });
    } catch (error) {
        logger.error("Error fetching customer coupons:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch customer coupons",
            error: error.message,
        });
    }
};
