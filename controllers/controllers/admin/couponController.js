const { Coupon, CouponAuditLog, Vendor, User, VendorCoupon } = require("../../models");
const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const CouponAuditService = require('../../services/couponAuditService');
const logger = require('../../utils/logger');

// Validate coupon fields based on scope business rules
const validateCouponByScope = (scope, data) => {
    const errors = [];

    switch (scope) {
        case 'PLATFORM':
            if (data.vendor_id) {
                errors.push('Platform coupons cannot have vendor_id — they are independent of vendors');
            }
            break;

        case 'NORMAL':
            if (!data.vendor_id) {
                errors.push('Normal (Partner) coupons must have vendor_id — they are vendor-dependent');
            }
            break;

        case 'SPECIAL':
            if (data.vendor_id) {
                errors.push('Special coupons must not have vendor_id — they target multiple vendors via target_vendor_ids');
            }
            if (!data.target_vendor_ids && !data.targetVendorIds) {
                errors.push('Special coupons must have target_vendor_ids array');
            } else {
                try {
                    const raw = data.target_vendor_ids || data.targetVendorIds;
                    const targetIds = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    if (!Array.isArray(targetIds) || targetIds.length === 0) {
                        errors.push('Special coupons must target at least one vendor ID');
                    }
                } catch (e) {
                    errors.push('Special coupons target_vendor_ids must be a valid JSON array');
                }
            }
            break;

        case 'PREMIUM':
            if (data.vendor_id) {
                errors.push('Premium coupons must not have vendor_id — they are tier-based');
            }
            if (!data.config) {
                errors.push('Premium coupons must have config with tierTarget');
            } else {
                try {
                    const config = typeof data.config === 'string' ? JSON.parse(data.config) : data.config;
                    if (!config.tierTarget || !['GOLD', 'PLATINUM', 'BOTH'].includes(config.tierTarget)) {
                        errors.push('Premium coupons must have valid tierTarget (GOLD, PLATINUM, or BOTH) in config');
                    }
                } catch (e) {
                    errors.push('Premium coupons must have valid JSON config');
                }
            }
            break;

        case 'INFLUENCER':
            if (data.vendor_id) {
                errors.push('Influencer coupons must not have vendor_id — they are platform-managed');
            }
            if (!data.config) {
                errors.push('Influencer coupons must have config with influencer details');
            } else {
                try {
                    const config = typeof data.config === 'string' ? JSON.parse(data.config) : data.config;
                    if (!config.influencerName) {
                        errors.push('Influencer coupons must have influencerName in config');
                    }
                    if (!config.commissionType || !['PERCENTAGE', 'FLAT', 'TIERED'].includes(config.commissionType)) {
                        errors.push('Influencer coupons must have valid commissionType (PERCENTAGE, FLAT, or TIERED) in config');
                    }
                    if (config.commissionValue === undefined || config.commissionValue <= 0) {
                        errors.push('Influencer coupons must have a positive commissionValue in config');
                    }
                } catch (e) {
                    errors.push('Influencer coupons must have valid JSON config');
                }
            }
            break;

        default:
            errors.push(`Invalid coupon scope: ${scope}`);
    }

    return errors;
};

// Get all coupons with vendor information
const getAllCoupons = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            approval_status,
            vendor_id,
            scope,
            search,
            sort_by = "created_at",
            sort_order = "DESC"
        } = req.query;

        // Whitelist sort_by to prevent SQL injection / invalid column 500s
        const allowedSortColumns = ['created_at', 'updated_at', 'valid_from', 'valid_until', 'status', 'approval_status', 'code'];
        const safeSortBy = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at';
        const safeSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const offset = (page - 1) * limit;
        const whereClause = {};

        // Filter by scope (Platform, Normal, Premium, etc.)
        if (scope) {
            whereClause.scope = scope;
        }

        // Filter by status
        if (status) {
            whereClause.status = status;
        }

        // Filter by approval status
        if (approval_status) {
            whereClause.approval_status = approval_status;
        }

        // Filter by vendor
        if (vendor_id) {
            whereClause.vendor_id = vendor_id;
        }

        // Search functionality
        if (search) {
            whereClause[Op.or] = [
                { code: { [Op.like]: `%${search}%` } },
                { title: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows: coupons } = await Coupon.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Vendor,
                    as: 'vendor',
                    attributes: ['id', 'business_name', 'company_info', 'status'],
                    include: [
                        {
                            model: User,
                            as: 'user',
                            attributes: ['id', 'name', 'email', 'phone']
                        }
                    ]
                }
            ],
            order: [[safeSortBy, safeSortOrder]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: {
                coupons,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: Math.ceil(count / limit),
                    total_items: count,
                    items_per_page: parseInt(limit)
                }
            }
        });

    } catch (error) {
        logger.error("Error fetching coupons:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch coupons",
            details: error.message
        });
    }
};

// Get single coupon by ID
const getCouponById = async (req, res) => {
    try {
        const { id } = req.params;

        const coupon = await Coupon.findByPk(id, {
            include: [
                {
                    model: Vendor,
                    as: 'vendor',
                    attributes: ['id', 'business_name', 'company_info', 'status'],
                    include: [
                        {
                            model: User,
                            as: 'user',
                            attributes: ['id', 'name', 'email', 'phone']
                        }
                    ]
                }
            ]
        });

        if (!coupon) {
            return res.status(404).json({
                success: false,
                error: "Coupon not found"
            });
        }

        res.json({
            success: true,
            data: coupon
        });

    } catch (error) {
        logger.error("Error fetching coupon:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch coupon",
            details: error.message
        });
    }
};

// Approve coupon
const approveCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const { admin_notes } = req.body;

        const coupon = await Coupon.findByPk(id);
        if (!coupon) {
            return res.status(404).json({
                success: false,
                error: "Coupon not found"
            });
        }

        if (coupon.approval_status === 'approved') {
            return res.status(400).json({
                success: false,
                error: "Coupon is already approved"
            });
        }

        await coupon.update({
            approval_status: 'approved',
            admin_notes: admin_notes || null,
            status: 'active' // Also activate the coupon
        });

        // Log the coupon approval
        const CouponAuditService = require('../../services/couponAuditService');
        await CouponAuditService.logCouponApproval(coupon, coupon.vendor_id, req);

        res.json({
            success: true,
            message: "Coupon approved successfully",
            data: coupon
        });

    } catch (error) {
        logger.error("Error approving coupon:", error);
        res.status(500).json({
            success: false,
            error: "Failed to approve coupon",
            details: error.message
        });
    }
};

// Reject coupon
const rejectCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const { admin_notes } = req.body;

        if (!admin_notes || admin_notes.trim() === '') {
            return res.status(400).json({
                success: false,
                error: "Admin notes are required when rejecting a coupon"
            });
        }

        const coupon = await Coupon.findByPk(id);
        if (!coupon) {
            return res.status(404).json({
                success: false,
                error: "Coupon not found"
            });
        }

        if (coupon.approval_status === 'rejected') {
            return res.status(400).json({
                success: false,
                error: "Coupon is already rejected"
            });
        }

        await coupon.update({
            approval_status: 'rejected',
            admin_notes: admin_notes,
            status: 'inactive' // Deactivate the coupon
        });

        // Log the coupon rejection
        const CouponAuditService = require('../../services/couponAuditService');
        await CouponAuditService.logCouponRejection(coupon, coupon.vendor_id, req);

        res.json({
            success: true,
            message: "Coupon rejected successfully",
            data: coupon
        });

    } catch (error) {
        logger.error("Error rejecting coupon:", error);
        res.status(500).json({
            success: false,
            error: "Failed to reject coupon",
            details: error.message
        });
    }
};

// Update coupon status (active/inactive)
const updateCouponStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['active', 'inactive', 'expired'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: "Invalid status. Must be active, inactive, or expired"
            });
        }

        const coupon = await Coupon.findByPk(id);
        if (!coupon) {
            return res.status(404).json({
                success: false,
                error: "Coupon not found"
            });
        }

        // Only allow status change if coupon is approved
        if (coupon.approval_status !== 'approved') {
            return res.status(400).json({
                success: false,
                error: "Only approved coupons can have their status changed"
            });
        }

        const previousStatus = coupon.status;
        await coupon.update({ status });

        // Log the status change
        const CouponAuditService = require('../../services/couponAuditService');
        await CouponAuditService.logAction({
            couponId: coupon.id,
            vendorId: coupon.vendor_id,
            action: 'status_change',
            details: {
                coupon_code: coupon.code,
                previous_status: previousStatus,
                new_status: status
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        });

        res.json({
            success: true,
            message: `Coupon status updated to ${status}`,
            data: coupon
        });

    } catch (error) {
        logger.error("Error updating coupon status:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update coupon status",
            details: error.message
        });
    }
};

// Delete coupon
const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;

        const coupon = await Coupon.findByPk(id);
        if (!coupon) {
            return res.status(404).json({
                success: false,
                error: "Coupon not found"
            });
        }

        await coupon.destroy();

        res.json({
            success: true,
            message: "Coupon deleted successfully"
        });

    } catch (error) {
        logger.error("Error deleting coupon:", error);
        res.status(500).json({
            success: false,
            error: "Failed to delete coupon",
            details: error.message
        });
    }
};

// Get coupon statistics
const getCouponStats = async (req, res) => {
    try {
        const stats = await Coupon.findAll({
            attributes: [
                'approval_status',
                [Coupon.sequelize.fn('COUNT', Coupon.sequelize.col('id')), 'count']
            ],
            group: ['approval_status'],
            raw: true
        });

        const totalCoupons = await Coupon.count();
        const totalVendors = await Vendor.count();

        const formattedStats = {
            total_coupons: totalCoupons,
            total_vendors: totalVendors,
            approval_status: {
                pending: 0,
                approved: 0,
                rejected: 0
            }
        };

        stats.forEach(stat => {
            formattedStats.approval_status[stat.approval_status] = parseInt(stat.count);
        });

        res.json({
            success: true,
            data: formattedStats
        });

    } catch (error) {
        logger.error("Error fetching coupon stats:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch coupon statistics",
            details: error.message
        });
    }
};

// Create coupon
const createCoupon = async (req, res) => {
    const t = await Coupon.sequelize.transaction();
    try {
        const {
            code, description, title, scope, mode, discount_type, discount_value,
            validFrom, validTill, totalUsageLimit, userLimit, autoApply, config,
            targetVendorIds, vendor_id, assigned_trek_id
        } = req.body;

        const resolvedScope = scope || 'NORMAL';

        // Validate scope-specific business rules
        const validationErrors = validateCouponByScope(resolvedScope, {
            vendor_id: vendor_id || null,
            config,
            target_vendor_ids: targetVendorIds ? JSON.stringify(targetVendorIds) : null,
            targetVendorIds
        });
        if (validationErrors.length > 0) {
            await t.rollback();
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validationErrors
            });
        }

        // Enforce vendor_id null for non-NORMAL scopes regardless of what was sent
        const resolvedVendorId = resolvedScope === 'NORMAL' ? (vendor_id || null) : null;

        const couponTitle = title || code;
        const valid_until = validTill || new Date(new Date().setFullYear(new Date().getFullYear() + 10));

        const newCoupon = await Coupon.create({
            code: code ? code.toUpperCase() : "COUPON",
            title: couponTitle,
            description,
            scope: resolvedScope,
            discount_type: (mode || discount_type || 'percentage').toLowerCase(),
            discount_value: (config && config.discountValue) ? config.discountValue : (discount_value || 0),
            valid_from: validFrom || new Date(),
            valid_until: valid_until,
            max_uses: totalUsageLimit || null,
            per_user_limit: userLimit || 1,
            config: config ? JSON.stringify(config) : null,
            target_vendor_ids: targetVendorIds ? JSON.stringify(targetVendorIds) : null,
            vendor_id: resolvedVendorId,
            assigned_trek_id: assigned_trek_id || null,
            approval_status: 'approved',
            status: 'active'
        }, { transaction: t });

        // Handle SPECIAL scope: Populate VendorCoupon table
        if (resolvedScope === 'SPECIAL' && targetVendorIds && Array.isArray(targetVendorIds)) {
            const vendorCouponEntries = targetVendorIds.map(vId => ({
                vendor_id: vId,
                coupon_id: newCoupon.id,
                assigned_at: new Date(),
                status: 'active'
            }));
            await VendorCoupon.bulkCreate(vendorCouponEntries, { transaction: t });
        }

        await t.commit();

        res.status(201).json({
            success: true,
            message: "Coupon created successfully",
            id: newCoupon.id,
            code: newCoupon.code,
            data: newCoupon
        });

    } catch (error) {
        await t.rollback();
        logger.error("Error creating coupon:", error);
        res.status(500).json({
            success: false,
            error: "Failed to create coupon",
            details: error.message
        });
    }
};

// Update coupon
const updateCoupon = async (req, res) => {
    const t = await Coupon.sequelize.transaction();
    try {
        const { id } = req.params;
        const updateData = req.body;

        const coupon = await Coupon.findByPk(id, { transaction: t });
        if (!coupon) {
            await t.rollback();
            return res.status(404).json({ success: false, error: "Coupon not found" });
        }

        // Determine effective scope after update
        const newScope = updateData.scope || coupon.scope;
        const newVendorId = updateData.vendor_id !== undefined ? updateData.vendor_id : coupon.vendor_id;
        const newConfig = updateData.config !== undefined ? updateData.config : coupon.config;
        const newTargetVendorIds = updateData.targetVendorIds !== undefined
            ? updateData.targetVendorIds
            : (updateData.target_vendor_ids !== undefined ? updateData.target_vendor_ids : coupon.target_vendor_ids);

        // Validate scope-specific business rules
        const validationErrors = validateCouponByScope(newScope, {
            vendor_id: newVendorId,
            config: newConfig,
            target_vendor_ids: newTargetVendorIds,
            targetVendorIds: newTargetVendorIds
        });
        if (validationErrors.length > 0) {
            await t.rollback();
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validationErrors
            });
        }

        // Build the update payload with explicit field mapping
        const dbUpdate = {};
        if (updateData.code !== undefined) dbUpdate.code = updateData.code;
        if (updateData.title !== undefined) dbUpdate.title = updateData.title;
        else if (updateData.code) dbUpdate.title = updateData.code;
        if (updateData.description !== undefined) dbUpdate.description = updateData.description;
        if (updateData.scope !== undefined) dbUpdate.scope = updateData.scope;
        if (updateData.status !== undefined) dbUpdate.status = updateData.status;
        if (updateData.discount_type !== undefined) dbUpdate.discount_type = updateData.discount_type;
        if (updateData.mode) dbUpdate.discount_type = updateData.mode.toLowerCase();
        if (updateData.discount_value !== undefined) dbUpdate.discount_value = updateData.discount_value;
        if (updateData.config && updateData.config.discountValue !== undefined) dbUpdate.discount_value = updateData.config.discountValue;
        if (updateData.validTill !== undefined) dbUpdate.valid_until = updateData.validTill || new Date(new Date().setFullYear(new Date().getFullYear() + 10));
        if (updateData.validFrom !== undefined) dbUpdate.valid_from = updateData.validFrom || new Date();
        if (updateData.valid_from !== undefined) dbUpdate.valid_from = updateData.valid_from;
        if (updateData.valid_until !== undefined) dbUpdate.valid_until = updateData.valid_until;
        if (updateData.totalUsageLimit !== undefined) dbUpdate.max_uses = updateData.totalUsageLimit || null;
        if (updateData.max_uses !== undefined) dbUpdate.max_uses = updateData.max_uses;
        if (updateData.userLimit !== undefined) dbUpdate.per_user_limit = updateData.userLimit;
        if (updateData.per_user_limit !== undefined) dbUpdate.per_user_limit = updateData.per_user_limit;
        if (updateData.min_amount !== undefined) dbUpdate.min_amount = updateData.min_amount;
        if (updateData.max_discount_amount !== undefined) dbUpdate.max_discount_amount = updateData.max_discount_amount;
        if (updateData.assigned_trek_id !== undefined) dbUpdate.assigned_trek_id = updateData.assigned_trek_id;
        if (updateData.config !== undefined) dbUpdate.config = JSON.stringify(updateData.config);
        if (updateData.targetVendorIds !== undefined) dbUpdate.target_vendor_ids = JSON.stringify(updateData.targetVendorIds);
        if (updateData.target_vendor_ids !== undefined) dbUpdate.target_vendor_ids = typeof updateData.target_vendor_ids === 'string' ? updateData.target_vendor_ids : JSON.stringify(updateData.target_vendor_ids);
        if (updateData.admin_notes !== undefined) dbUpdate.admin_notes = updateData.admin_notes;

        // Enforce vendor_id rules based on resolved scope
        dbUpdate.vendor_id = newScope === 'NORMAL' ? newVendorId : null;

        await coupon.update(dbUpdate, { transaction: t });

        // Handle SPECIAL scope synchronization
        if (newScope === 'SPECIAL' && newTargetVendorIds) {
            const targetIds = Array.isArray(newTargetVendorIds) 
                ? newTargetVendorIds 
                : (typeof newTargetVendorIds === 'string' ? JSON.parse(newTargetVendorIds) : []);
            
            if (Array.isArray(targetIds)) {
                // Remove old links
                await VendorCoupon.destroy({
                    where: { coupon_id: id },
                    transaction: t
                });
                
                // Add new links
                const newLinks = targetIds.map(vId => ({
                    vendor_id: vId,
                    coupon_id: id,
                    assigned_at: new Date(),
                    status: 'active'
                }));
                await VendorCoupon.bulkCreate(newLinks, { transaction: t });
            }
        } else if (newScope !== 'SPECIAL') {
            // If scope changed from SPECIAL to something else, remove links
            await VendorCoupon.destroy({
                where: { coupon_id: id },
                transaction: t
            });
        }

        await t.commit();

        res.json({
            success: true,
            message: "Coupon updated successfully",
            data: coupon
        });
    } catch (error) {
        await t.rollback();
        logger.error("Error updating coupon:", error);
        res.status(500).json({ success: false, error: "Failed to update coupon", details: error.message });
    }
};

module.exports = {
    getAllCoupons,
    getCouponById,
    createCoupon,
    updateCoupon,
    approveCoupon,
    rejectCoupon,
    updateCouponStatus,
    deleteCoupon,
    getCouponStats
};
