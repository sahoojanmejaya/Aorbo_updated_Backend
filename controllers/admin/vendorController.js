/**
 * Vendor Controller for Admin Panel
 * 
 * @description Handles vendor management operations for administrators
 * @author Kiro AI Assistant
 * @created 2026-03-09 16:16:00 IST
 * @updated 2026-03-09 16:16:00 IST
 * 
 * @routes
 * GET    /api/admin/vendors              - Get all vendors with filters
 * GET    /api/admin/vendors/statistics   - Get vendor statistics
 * GET    /api/admin/vendors/:id          - Get specific vendor details
 * PUT    /api/admin/vendors/:id          - Update vendor details
 * PUT    /api/admin/vendors/:id/status   - Update vendor status
 * DELETE /api/admin/vendors/:id          - Delete/Deactivate vendor
 */

const { Vendor, Trek, Booking, User } = require('../../models');
const { Op } = require('sequelize');
const logger = require('../../utils/logger');

/**
 * Get all vendors with filters
 * @route GET /api/admin/vendors
 * @access Private (Admin only)
 * @created 2026-03-09 16:16:00 IST
 */
exports.getVendors = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            status = '',
            kyc_status = '',
            date_from = '',
            date_to = ''
        } = req.query;

        // Build search conditions
        const whereConditions = {};

        if (search) {
            whereConditions[Op.or] = [
                { business_name: { [Op.like]: `%${search}%` } },
                { gstin: { [Op.like]: `%${search}%` } },
                { pan_no: { [Op.like]: `%${search}%` } }
            ];
        }

        if (status) {
            whereConditions.status = status;
        }

        if (kyc_status) {
            whereConditions.kyc_status = kyc_status;
        }

        // Date range filter
        if (date_from || date_to) {
            whereConditions.created_at = {};
            if (date_from) {
                whereConditions.created_at[Op.gte] = new Date(date_from);
            }
            if (date_to) {
                whereConditions.created_at[Op.lte] = new Date(date_to);
            }
        }

        // Calculate offset
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Fix for ambiguous column error: separate count and data queries
        // First get the count without includes to avoid ambiguity
        const count = await Vendor.count({
            where: whereConditions
        });

        // Then get the actual data with includes - SIMPLIFIED FOR DEBUGGING
        const vendors = await Vendor.findAll({
            where: whereConditions,
            attributes: [
                'id', 'business_name', 'business_address', 'gstin', 'pan_no', 'status',
                'kyc_status', 'created_at', 'updated_at'
            ],
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'phone'],
                    required: false
                },
                {
                    model: Trek,
                    as: 'treks',
                    attributes: ['id', 'title', 'status'],
                    required: false
                }
            ],
            limit: parseInt(limit),
            offset: offset,
            order: [['created_at', 'DESC']]
        });

        // Calculate additional statistics for each vendor
        const vendorsWithStats = await Promise.all(vendors.map(async (vendor) => {
            const vendorData = vendor.toJSON();
            
            try {
                // Get trek count
                const trekCount = await Trek.count({ where: { vendor_id: vendor.id } });
                
                // Get booking count and revenue - Fixed approach to avoid ambiguous columns
                const vendorTrekIds = await Trek.findAll({
                    where: { vendor_id: vendor.id },
                    attributes: ['id'],
                    raw: true
                });
                
                const trekIds = vendorTrekIds.map(trek => trek.id);
                
                let bookingCount = 0;
                let totalRevenue = 0;
                
                if (trekIds.length > 0) {
                    const bookingStats = await Booking.findAll({
                        attributes: [
                            [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'booking_count'],
                            [require('sequelize').fn('SUM', require('sequelize').col('total_amount')), 'total_revenue']
                        ],
                        where: {
                            trek_id: trekIds
                        },
                        raw: true
                    });
                    
                    bookingCount = parseInt(bookingStats[0]?.booking_count || 0);
                    totalRevenue = parseFloat(bookingStats[0]?.total_revenue || 0);
                }

                vendorData.statistics = {
                    trek_count: trekCount,
                    booking_count: bookingCount,
                    total_revenue: totalRevenue.toFixed(2)
                };
            } catch (statsError) {
                // If statistics calculation fails, provide default values
                logger.warn('warn', 'Failed to calculate vendor statistics', {
                    vendor_id: vendor.id,
                    error: statsError.message
                });
                
                vendorData.statistics = {
                    trek_count: 0,
                    booking_count: 0,
                    total_revenue: '0.00'
                };
            }

            return vendorData;
        }));

        logger.api('info', 'Admin vendors fetched successfully', {
            admin_id: req.user?.id,
            total_count: count,
            filters: { status, kyc_status, search }
        });

        res.json({
            success: true,
            message: 'Vendors fetched successfully',
            data: {
                vendors: vendorsWithStats,
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
        logger.error('error', 'Error fetching vendors', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to fetch vendors',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get vendor statistics
 * @route GET /api/admin/vendors/statistics
 * @access Private (Admin only)
 * @created 2026-03-09 16:16:00 IST
 */
exports.getVendorStatistics = async (req, res) => {
    try {
        // Get overall vendor statistics
        const totalVendors = await Vendor.count();
        const activeVendors = await Vendor.count({ where: { status: 'approved' } });
        const pendingVendors = await Vendor.count({ where: { status: 'pending' } });
        const rejectedVendors = await Vendor.count({ where: { status: 'rejected' } });

        // Get KYC statistics
        const kycApproved = await Vendor.count({ where: { kyc_status: 'approved' } });
        const kycPending = await Vendor.count({ where: { kyc_status: 'pending' } });
        const kycRejected = await Vendor.count({ where: { kyc_status: 'rejected' } });

        // Get monthly registration trend (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyTrend = await Vendor.findAll({
            attributes: [
                [require('sequelize').fn('DATE_FORMAT', require('sequelize').col('created_at'), '%Y-%m'), 'month'],
                [require('sequelize').fn('COUNT', require('sequelize').col('Vendor.id')), 'count']
            ],
            where: {
                created_at: { [Op.gte]: sixMonthsAgo }
            },
            group: [require('sequelize').fn('DATE_FORMAT', require('sequelize').col('created_at'), '%Y-%m')],
            order: [[require('sequelize').fn('DATE_FORMAT', require('sequelize').col('created_at'), '%Y-%m'), 'ASC']],
            raw: true
        });

        // Get top vendors by trek count
        const topVendorsByTreks = await Vendor.findAll({
            attributes: [
                'id', 'business_name', 'contact_email',
                [require('sequelize').fn('COUNT', require('sequelize').col('treks.id')), 'trek_count']
            ],
            include: [
                {
                    model: Trek,
                    as: 'treks',
                    attributes: [],
                    required: false
                }
            ],
            group: ['Vendor.id'],
            order: [[require('sequelize').fn('COUNT', require('sequelize').col('treks.id')), 'DESC']],
            limit: 10,
            raw: false
        });

        // Get vendors by status
        const vendorsByStatus = await Vendor.findAll({
            attributes: [
                'status',
                [require('sequelize').fn('COUNT', require('sequelize').col('Vendor.id')), 'count']
            ],
            group: ['status'],
            raw: true
        });

        logger.api('info', 'Vendor statistics fetched successfully', {
            admin_id: req.user?.id
        });

        res.json({
            success: true,
            message: 'Vendor statistics fetched successfully',
            data: {
                overview: {
                    total_vendors: totalVendors,
                    active_vendors: activeVendors,
                    pending_vendors: pendingVendors,
                    rejected_vendors: rejectedVendors,
                    kyc_approved: kycApproved,
                    kyc_pending: kycPending,
                    kyc_rejected: kycRejected
                },
                monthly_trend: monthlyTrend,
                top_vendors_by_treks: topVendorsByTreks,
                vendors_by_status: vendorsByStatus,
                last_updated: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('error', 'Error fetching vendor statistics', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to fetch vendor statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get specific vendor details
 * @route GET /api/admin/vendors/:id
 * @access Private (Admin only)
 * @created 2026-03-09 16:16:00 IST
 */
exports.getVendorById = async (req, res) => {
    try {
        const { id } = req.params;

        const vendor = await Vendor.findByPk(id, {
            attributes: [
                'id', 'business_name', 'business_address', 'gstin', 'pan_no', 'status',
                'kyc_status', 'created_at', 'updated_at'
            ],
            include: [
                {
                    model: Trek,
                    as: 'treks',
                    attributes: ['id', 'title', 'status', 'base_price', 'created_at']
                }
            ]
        });

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor not found'
            });
        }

        // Get additional statistics
        const bookingStats = await Booking.findAll({
            attributes: [
                [require('sequelize').fn('COUNT', require('sequelize').col('Booking.id')), 'booking_count'],
                [require('sequelize').fn('SUM', require('sequelize').col('Booking.total_amount')), 'total_revenue']
            ],
            include: [
                {
                    model: Trek,
                    as: 'trek',
                    where: { vendor_id: id },
                    attributes: []
                }
            ],
            raw: true
        });

        const vendorData = vendor.toJSON();
        vendorData.statistics = {
            trek_count: vendor.treks.length,
            booking_count: parseInt(bookingStats[0]?.booking_count || 0),
            total_revenue: parseFloat(bookingStats[0]?.total_revenue || 0).toFixed(2)
        };

        logger.api('info', 'Vendor details fetched successfully', {
            admin_id: req.user?.id,
            vendor_id: id
        });

        res.json({
            success: true,
            message: 'Vendor details fetched successfully',
            data: vendorData
        });

    } catch (error) {
        logger.error('error', 'Error fetching vendor details', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id,
            vendor_id: req.params.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to fetch vendor details',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Update vendor details
 * @route PUT /api/admin/vendors/:id
 * @access Private (Admin only)
 * @created 2026-03-09 16:16:00 IST
 */
exports.updateVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            business_name, 
            contact_email, 
            contact_phone, 
            business_address, 
            gst_number, 
            pan_number,
            kyc_status 
        } = req.body;

        const vendor = await Vendor.findByPk(id);
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor not found'
            });
        }

        // Check if email already exists (excluding current vendor)
        if (contact_email && contact_email !== vendor.contact_email) {
            const existingVendor = await Vendor.findOne({ 
                where: { 
                    contact_email,
                    id: { [Op.ne]: id }
                }
            });
            if (existingVendor) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already exists'
                });
            }
        }

        // Update vendor
        const updateData = {};
        if (business_name) updateData.business_name = business_name;
        if (contact_email) updateData.contact_email = contact_email;
        if (contact_phone) updateData.contact_phone = contact_phone;
        if (business_address) updateData.business_address = business_address;
        if (gst_number) updateData.gst_number = gst_number;
        if (pan_number) updateData.pan_number = pan_number;
        if (kyc_status) updateData.kyc_status = kyc_status;
        updateData.updated_at = new Date();

        await vendor.update(updateData);

        logger.api('info', 'Vendor updated successfully', {
            admin_id: req.user?.id,
            vendor_id: id,
            updated_fields: Object.keys(updateData)
        });

        res.json({
            success: true,
            message: 'Vendor updated successfully',
            data: {
                vendor_id: id,
                updated_fields: Object.keys(updateData),
                updated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('error', 'Error updating vendor', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id,
            vendor_id: req.params.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to update vendor',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Update vendor status
 * @route PUT /api/admin/vendors/:id/status
 * @access Private (Admin only)
 * @created 2026-03-09 16:16:00 IST
 */
exports.updateVendorStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        // Validate status
        const validStatuses = ['pending', 'approved', 'rejected', 'suspended'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
            });
        }

        const vendor = await Vendor.findByPk(id);
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor not found'
            });
        }

        const oldStatus = vendor.status;

        // Update vendor status
        const updateData = {
            status: status,
            updated_at: new Date()
        };

        if (status === 'approved') {
            updateData.status = 'active';
        } else if (status === 'rejected') {
            updateData.rejected_at = new Date();
            updateData.rejected_by = req.user.id;
            updateData.rejection_reason = reason || 'No reason provided';
        }

        await vendor.update(updateData);

        logger.api('info', 'Vendor status updated successfully', {
            admin_id: req.user?.id,
            vendor_id: id,
            old_status: oldStatus,
            new_status: status,
            reason: reason || 'No reason provided'
        });

        res.json({
            success: true,
            message: 'Vendor status updated successfully',
            data: {
                vendor_id: id,
                old_status: oldStatus,
                new_status: status,
                updated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('error', 'Error updating vendor status', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id,
            vendor_id: req.params.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to update vendor status',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Delete/Deactivate vendor
 * @route DELETE /api/admin/vendors/:id
 * @access Private (Admin only)
 * @created 2026-03-09 16:16:00 IST
 */
exports.deleteVendor = async (req, res) => {
    try {
        const { id } = req.params;

        const vendor = await Vendor.findByPk(id);
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor not found'
            });
        }

        // Soft delete - just deactivate the vendor
        await vendor.update({
            status: 'suspended',
            updated_at: new Date()
        });

        logger.api('info', 'Vendor deactivated successfully', {
            admin_id: req.user?.id,
            vendor_id: id,
            vendor_email: vendor.contact_email
        });

        res.json({
            success: true,
            message: 'Vendor deactivated successfully',
            data: {
                vendor_id: id,
                status: 'suspended',
                deactivated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('error', 'Error deleting vendor', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id,
            vendor_id: req.params.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to delete vendor',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};