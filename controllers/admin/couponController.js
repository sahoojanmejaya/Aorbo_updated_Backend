const { Coupon, CouponAuditLog, Vendor, User } = require("../../models");
const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const CouponAuditService = require('../../services/couponAuditService');

// Get all coupons with vendor information
const getAllCoupons = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            approval_status,
            vendor_id,
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
        console.error("Error fetching coupons:", error);
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
        console.error("Error fetching coupon:", error);
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
        console.error("Error approving coupon:", error);
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
        console.error("Error rejecting coupon:", error);
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
        console.error("Error updating coupon status:", error);
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
        console.error("Error deleting coupon:", error);
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
        console.error("Error fetching coupon stats:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch coupon statistics",
            details: error.message
        });
    }
};

module.exports = {
    getAllCoupons,
    getCouponById,
    approveCoupon,
    rejectCoupon,
    updateCouponStatus,
    deleteCoupon,
    getCouponStats
};
