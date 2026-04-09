/**
 * Vendor Request Controller for Admin Panel
 * 
 * @description Handles vendor approval/rejection operations for administrators
 * @author Kiro AI Assistant
 * @created 2026-03-09 15:35:00 IST
 * @updated 2026-03-25 12:00:00 IST
 * 
 * @routes
 * GET    /api/admin/vendor-requests/pending    - Get pending vendor requests
 * GET    /api/admin/vendor-requests            - Get all vendor requests with filters
 * GET    /api/admin/vendor-requests/:id        - Get specific vendor request details
 * PUT    /api/admin/vendor-requests/:id/approve - Approve vendor request
 * PUT    /api/admin/vendor-requests/:id/reject  - Reject vendor request
 * PUT    /api/admin/vendor-requests/:id/reverify - Request re-verification
 */

const { Vendor, User } = require('../../models');
const { Op } = require('sequelize');
const logger = require('../../utils/logger');
const bcrypt = require('bcryptjs');

/**
 * Get pending vendor requests
 * @route GET /api/admin/vendor-requests/pending
 * @access Private (Admin only)
 * @created 2026-03-09 15:35:00 IST
 */
exports.getPendingVendorRequests = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = ''
        } = req.query;

        // Build search conditions
        const whereConditions = {
            status: 'pending' // Only pending requests
        };

        if (search) {
            whereConditions[Op.or] = [
                { business_name: { [Op.like]: `%${search}%` } },
                { '$user.email$': { [Op.like]: `%${search}%` } },
                { '$user.phone$': { [Op.like]: `%${search}%` } }
            ];
        }

        // Calculate offset
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Fetch pending vendor requests
        const { count, rows: vendorRequestsData } = await Vendor.findAndCountAll({
            where: whereConditions,
            attributes: [
                'id', 'business_name', 'business_address', 'gstin', 'pan_no', 'status',
                'kyc_status', 'created_at', 'updated_at'
            ],
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['email', 'phone']
                }
            ],
            limit: parseInt(limit),
            offset: offset,
            order: [['created_at', 'ASC']] // Oldest first for pending requests
        });

        const vendorRequests = vendorRequestsData.map(v => {
            const data = v.toJSON();
            return {
                ...data,
                contact_email: data.user ? data.user.email : null,
                contact_phone: data.user ? data.user.phone : null,
                user: undefined
            };
        });

        logger.api('info', 'Pending vendor requests fetched successfully', {
            admin_id: req.user?.id,
            total_count: count,
            page: parseInt(page)
        });

        res.json({
            success: true,
            message: 'Pending vendor requests fetched successfully',
            data: {
                vendor_requests: vendorRequests,
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
        logger.error('error', 'Error fetching pending vendor requests', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending vendor requests',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get all vendor requests with filters
 * @route GET /api/admin/vendor-requests
 * @access Private (Admin only)
 * @created 2026-03-09 15:35:00 IST
 */
exports.getAllVendorRequests = async (req, res) => {
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
                { '$user.email$': { [Op.like]: `%${search}%` } },
                { '$user.phone$': { [Op.like]: `%${search}%` } }
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

        // Fetch vendor requests
        const { count, rows: vendorRequestsData } = await Vendor.findAndCountAll({
            where: whereConditions,
            attributes: [
                'id', 'business_name', 'business_address', 'gstin', 'pan_no', 'status',
                'kyc_status', 'created_at', 'updated_at'
            ],
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['email', 'phone']
                }
            ],
            limit: parseInt(limit),
            offset: offset,
            order: [['created_at', 'DESC']]
        });

        const vendorRequests = vendorRequestsData.map(v => {
            const data = v.toJSON();
            return {
                ...data,
                contact_email: data.user ? data.user.email : null,
                contact_phone: data.user ? data.user.phone : null,
                user: undefined
            };
        });

        logger.api('info', 'Vendor requests fetched successfully', {
            admin_id: req.user?.id,
            total_count: count,
            filters: { status, kyc_status, search }
        });

        res.json({
            success: true,
            message: 'Vendor requests fetched successfully',
            data: {
                vendor_requests: vendorRequests,
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
        logger.error('error', 'Error fetching vendor requests', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to fetch vendor requests',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get specific vendor request details
 * @route GET /api/admin/vendor-requests/:id
 * @access Private (Admin only)
 * @created 2026-03-09 15:35:00 IST
 */
exports.getVendorRequestById = async (req, res) => {
    try {
        const { id } = req.params;

        const vendorRequestData = await Vendor.findByPk(id, {
            attributes: [
                'id', 'business_name', 'business_address', 'gstin', 'pan_no', 'status',
                'kyc_status', 'created_at', 'updated_at',
                'remark', 'status_reason',
                'pan_card_path', 'id_proof_path', 'cancelled_cheque_path', 'gstin_certificate_path', 'msme_certificate_path', 'shop_establishment_path'
            ],
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['email', 'phone']
                }
            ]
        });

        let vendorRequest = null;
        if (vendorRequestData) {
            const data = vendorRequestData.toJSON();
            vendorRequest = {
                ...data,
                contact_email: data.user ? data.user.email : null,
                contact_phone: data.user ? data.user.phone : null,
                user: undefined
            };
        }

        if (!vendorRequest) {
            return res.status(404).json({
                success: false,
                message: 'Vendor request not found'
            });
        }

        logger.api('info', 'Vendor request details fetched successfully', {
            admin_id: req.user?.id,
            vendor_id: id
        });

        res.json({
            success: true,
            message: 'Vendor request details fetched successfully',
            data: vendorRequest
        });

    } catch (error) {
        logger.error('error', 'Error fetching vendor request details', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id,
            vendor_id: req.params.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to fetch vendor request details',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Approve vendor request
 * @route PUT /api/admin/vendor-requests/:id/approve
 * @access Private (Admin only)
 * @created 2026-03-09 15:35:00 IST
 * @updated 2026-03-25 12:00:00 IST - BUG #15 & #17 FIXES
 */
exports.approveVendorRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { approval_notes = '' } = req.body;

        const vendor = await Vendor.findByPk(id, {
            include: [{ model: User, as: 'user', attributes: ['email'] }]
        });
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor request not found'
            });
        }

        // BUG #15 FIX: Check application_status not status for already-approved guard
        if (vendor.application_status === 'APPROVED') {
            return res.status(400).json({
                success: false,
                message: 'Vendor request is already approved'
            });
        }

        // BUG #15 FIX: Changed status:'approved' to application_status:'APPROVED' + status:'active'
        // 'approved' is not a valid ENUM value for status column (valid: active/inactive/suspended/banned)
        // application_status is the correct field for tracking approval workflow
        await vendor.update({
            application_status: 'APPROVED',
            status: 'active',
            remark: approval_notes || 'Application approved by admin'
        });

        // BUG #17 FIX: Removed duplicate User creation on approval — User was already created in savePersonalBusinessStep (KYC Step 1)
        // The old code used User.findOne({ where: { vendor_id } }) which never finds existing users because
        // users are linked via vendor.user_id (not user.vendor_id), causing a second User to be created every approval

        logger.api('info', 'Vendor request approved successfully', {
            admin_id: req.user?.id,
            vendor_id: vendor.id,
            vendor_email: vendor.user ? vendor.user.email : null,
            approval_notes: approval_notes
        });

        res.json({
            success: true,
            message: 'Vendor request approved successfully',
            data: {
                vendor_id: vendor.id,
                business_name: vendor.business_name,
                status: 'approved'
            }
        });

    } catch (error) {
        logger.error('error', 'Error approving vendor request', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id,
            vendor_id: req.params.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to approve vendor request',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Reject vendor request
 * @route PUT /api/admin/vendor-requests/:id/reject
 * @access Private (Admin only)
 * @created 2026-03-09 15:35:00 IST
 * @updated 2026-03-25 12:00:00 IST - BUG #16 FIX
 */
exports.rejectVendorRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejection_reason } = req.body;

        if (!rejection_reason) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required'
            });
        }

        const vendor = await Vendor.findByPk(id, {
            include: [{ model: User, as: 'user', attributes: ['email'] }]
        });
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor request not found'
            });
        }

        // BUG #16 FIX: Check application_status for already-rejected guard
        if (vendor.application_status === 'REJECTED') {
            return res.status(400).json({
                success: false,
                message: 'Vendor request is already rejected'
            });
        }

        // BUG #16 FIX: Changed status:'rejected' to application_status:'REJECTED' with status_reason
        // 'rejected' is not a valid ENUM value for status column
        // application_status + status_reason are the correct fields for rejection workflow
        await vendor.update({
            application_status: 'REJECTED',
            status_reason: rejection_reason,
            remark: rejection_reason
        });

        logger.api('info', 'Vendor request rejected successfully', {
            admin_id: req.user?.id,
            vendor_id: vendor.id,
            vendor_email: vendor.user ? vendor.user.email : null,
            rejection_reason: rejection_reason
        });

        res.json({
            success: true,
            message: 'Vendor request rejected successfully',
            data: {
                vendor_id: vendor.id,
                business_name: vendor.business_name,
                status: 'rejected',
                rejected_at: new Date().toISOString(),
                rejected_by: req.user.id,
                rejection_reason: rejection_reason
            }
        });

    } catch (error) {
        logger.error('error', 'Error rejecting vendor request', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id,
            vendor_id: req.params.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to reject vendor request',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Request re-verification from vendor
 * @route PUT /api/admin/vendor-requests/:id/reverify
 * @access Private (Admin only)
 * @created 2026-03-25 12:00:00 IST - BUG #32 FIX
 */
exports.requestReverification = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes, documents_to_fix } = req.body;

        if (!notes) {
            return res.status(400).json({
                success: false,
                message: 'Notes explaining what needs to be fixed are required'
            });
        }

        const vendor = await Vendor.findByPk(id);
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor not found'
            });
        }

        await vendor.update({
            application_status: 'REVERIFICATION_PENDING',
            status_reason: notes,
            remark: documents_to_fix ? `Documents to fix: ${documents_to_fix.join(', ')}` : notes
        });

        logger.api('info', 'Vendor re-verification requested', {
            admin_id: req.user?.id,
            vendor_id: vendor.id,
            notes: notes
        });

        res.json({
            success: true,
            message: 'Re-verification request sent to vendor',
            data: { 
                vendor_id: vendor.id, 
                application_status: 'REVERIFICATION_PENDING' 
            }
        });

    } catch (error) {
        logger.error('error', 'Error requesting re-verification', { 
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id,
            vendor_id: req.params.id
        });

        res.status(500).json({ 
            success: false, 
            message: 'Failed to request re-verification' 
        });
    }
};