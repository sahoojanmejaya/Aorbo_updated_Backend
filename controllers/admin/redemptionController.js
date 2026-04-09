/**
 * Redemption Controller for Admin Panel
 * 
 * @description Handles coupon redemption operations for administrators
 * @author Kiro AI Assistant
 * @created 2026-03-09 16:10:00 IST
 * @updated 2026-03-16 12:00:00 IST
 * 
 * @routes
 * GET    /api/admin/redemptions              - Get all redemptions with filters
 * GET    /api/admin/redemptions/statistics   - Get redemption statistics
 * GET    /api/admin/redemptions/:id          - Get specific redemption details
 * PUT    /api/admin/redemptions/:id/status   - Update redemption status
 */

const { Booking, Coupon, Customer, Trek, Vendor } = require('../../models');
const { Op } = require('sequelize');
const logger = require('../../utils/logger');

/**
 * Get all redemptions (bookings with coupons)
 * @route GET /api/admin/redemptions
 * @access Private (Admin only)
 */
exports.getAllRedemptions = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            couponCode,
            scope,
            status,
            dateFrom,
            dateTo
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const whereClause = {
            coupon_id: { [Op.ne]: null }
        };

        if (status) {
            whereClause.status = status.toLowerCase();
        }

        if (dateFrom || dateTo) {
            whereClause.booking_date = {};
            if (dateFrom) whereClause.booking_date[Op.gte] = new Date(dateFrom);
            if (dateTo) whereClause.booking_date[Op.lte] = new Date(dateTo);
        }

        const include = [
            {
                model: Coupon,
                as: 'coupon',
                attributes: ['id', 'code', 'scope', 'discount_type', 'discount_value'],
                where: couponCode ? { code: couponCode } : (scope ? { scope: scope.toUpperCase() } : {}),
                required: true
            },
            {
                model: Customer,
                as: 'customer',
                attributes: ['id', 'name', 'email', 'phone']
            },
            {
                model: Trek,
                as: 'trek',
                attributes: ['id', 'title', 'duration']
            },
            {
                model: Vendor,
                as: 'vendor',
                attributes: ['id', 'business_name']
            }
        ];

        const { count, rows: bookings } = await Booking.findAndCountAll({
            where: whereClause,
            include: include,
            limit: parseInt(limit),
            offset: offset,
            order: [['created_at', 'DESC']],
            distinct: true
        });

        // Transform the data to match expected redemption format
        const redemptions = bookings.map(booking => ({
            id: booking.id,
            booking_id: booking.booking_id,
            customer: booking.customer,
            coupon: booking.coupon,
            trek: booking.trek,
            vendor: booking.vendor,
            total_amount: booking.total_amount,
            discount_amount: booking.discount_amount,
            final_amount: booking.final_amount,
            booking_status: booking.status,
            booking_date: booking.booking_date,
            created_at: booking.created_at,
            redeemed_at: booking.created_at // Use booking creation as redemption time
        }));

        logger.api('info', 'Redemptions fetched successfully', {
            admin_id: req.user?.id,
            total_count: count,
            filters: { couponCode, scope, status }
        });

        res.json({
            success: true,
            message: 'Redemptions fetched successfully',
            data: {
                redemptions: redemptions,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: Math.ceil(count / parseInt(limit)),
                    total_count: count,
                    per_page: parseInt(limit),
                    has_next: parseInt(page) < Math.ceil(count / parseInt(limit)),
                    has_prev: parseInt(page) > 1
                }
            }
        });

    } catch (error) {
        logger.error('error', 'Error fetching redemptions', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to fetch redemptions',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get redemption statistics
 * @route GET /api/admin/redemptions/statistics
 * @access Private (Admin only)
 */
exports.getRedemptionStatistics = async (req, res) => {
    try {
        // Get overall statistics
        const totalRedemptions = await Booking.count({
            where: { coupon_id: { [Op.ne]: null } }
        });
        
        const successfulRedemptions = await Booking.count({
            where: { 
                coupon_id: { [Op.ne]: null },
                status: 'confirmed'
            }
        });
        
        const pendingRedemptions = await Booking.count({
            where: { 
                coupon_id: { [Op.ne]: null },
                status: 'pending'
            }
        });

        // Get total discount amount
        const totalDiscountResult = await Booking.sum('discount_amount', {
            where: { coupon_id: { [Op.ne]: null } }
        });
        const totalDiscountAmount = totalDiscountResult || 0;

        // Get monthly redemption trend (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyTrend = await Booking.findAll({
            attributes: [
                [require('sequelize').fn('DATE_FORMAT', require('sequelize').col('created_at'), '%Y-%m'), 'month'],
                [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
                [require('sequelize').fn('SUM', require('sequelize').col('discount_amount')), 'total_discount']
            ],
            where: {
                coupon_id: { [Op.ne]: null },
                created_at: { [Op.gte]: sixMonthsAgo }
            },
            group: [require('sequelize').fn('DATE_FORMAT', require('sequelize').col('created_at'), '%Y-%m')],
            order: [[require('sequelize').fn('DATE_FORMAT', require('sequelize').col('created_at'), '%Y-%m'), 'ASC']],
            raw: true
        });

        // Get top performing coupons
        const topCoupons = await Booking.findAll({
            attributes: [
                'coupon_id',
                [require('sequelize').fn('COUNT', require('sequelize').col('Booking.id')), 'redemption_count'],
                [require('sequelize').fn('SUM', require('sequelize').col('discount_amount')), 'total_discount']
            ],
            include: [
                {
                    model: Coupon,
                    as: 'coupon',
                    attributes: ['code', 'title', 'discount_type', 'discount_value']
                }
            ],
            where: { coupon_id: { [Op.ne]: null } },
            group: ['coupon_id', 'coupon.id'],
            order: [[require('sequelize').fn('COUNT', require('sequelize').col('Booking.id')), 'DESC']],
            limit: 10,
            raw: false
        });

        logger.api('info', 'Redemption statistics fetched successfully', {
            admin_id: req.user?.id
        });

        res.json({
            success: true,
            message: 'Redemption statistics fetched successfully',
            data: {
                overview: {
                    total_redemptions: totalRedemptions,
                    successful_redemptions: successfulRedemptions,
                    pending_redemptions: pendingRedemptions,
                    total_discount_amount: parseFloat(totalDiscountAmount).toFixed(2)
                },
                monthly_trend: monthlyTrend,
                top_coupons: topCoupons,
                last_updated: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('error', 'Error fetching redemption statistics', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to fetch redemption statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get specific redemption details
 * @route GET /api/admin/redemptions/:id
 * @access Private (Admin only)
 */
exports.getRedemptionById = async (req, res) => {
    try {
        const { id } = req.params;

        const booking = await Booking.findByPk(id, {
            include: [
                {
                    model: Coupon,
                    as: 'coupon',
                    attributes: ['id', 'code', 'title', 'description', 'discount_type', 'discount_value', 'status']
                },
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['id', 'name', 'email', 'phone']
                },
                {
                    model: Trek,
                    as: 'trek',
                    attributes: ['id', 'title', 'duration']
                },
                {
                    model: Vendor,
                    as: 'vendor',
                    attributes: ['id', 'business_name']
                }
            ]
        });

        if (!booking || !booking.coupon_id) {
            return res.status(404).json({
                success: false,
                message: 'Redemption not found'
            });
        }

        // Transform to redemption format
        const redemption = {
            id: booking.id,
            booking_id: booking.booking_id,
            customer: booking.customer,
            coupon: booking.coupon,
            trek: booking.trek,
            vendor: booking.vendor,
            total_amount: booking.total_amount,
            discount_amount: booking.discount_amount,
            final_amount: booking.final_amount,
            booking_status: booking.status,
            booking_date: booking.booking_date,
            created_at: booking.created_at,
            redeemed_at: booking.created_at
        };

        logger.api('info', 'Redemption details fetched successfully', {
            admin_id: req.user?.id,
            redemption_id: id
        });

        res.json({
            success: true,
            message: 'Redemption details fetched successfully',
            data: redemption
        });

    } catch (error) {
        logger.error('error', 'Error fetching redemption details', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id,
            redemption_id: req.params.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to fetch redemption details',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Update redemption status (updates booking status)
 * @route PUT /api/admin/redemptions/:id/status
 * @access Private (Admin only)
 */
exports.updateRedemptionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        // Validate status
        const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
            });
        }

        const booking = await Booking.findByPk(id);
        if (!booking || !booking.coupon_id) {
            return res.status(404).json({
                success: false,
                message: 'Redemption not found'
            });
        }

        const oldStatus = booking.status;

        // Update booking status
        await booking.update({
            status: status,
            updated_at: new Date()
        });

        logger.api('info', 'Redemption status updated successfully', {
            admin_id: req.user?.id,
            redemption_id: id,
            old_status: oldStatus,
            new_status: status,
            reason: reason || 'No reason provided'
        });

        res.json({
            success: true,
            message: 'Redemption status updated successfully',
            data: {
                redemption_id: id,
                old_status: oldStatus,
                new_status: status,
                updated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('error', 'Error updating redemption status', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id,
            redemption_id: req.params.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to update redemption status',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};