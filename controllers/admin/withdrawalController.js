/**
 * Withdrawal Controller for Admin Panel
 * 
 * @description Handles vendor withdrawal request operations for administrators
 * @author Kiro AI Assistant
 * @created 2026-03-16 12:00:00 IST
 * @updated 2026-03-16 12:00:00 IST
 * 
 * @routes
 * GET    /api/admin/withdrawals              - Get all withdrawal requests
 * GET    /api/admin/withdrawals/pending      - Get pending withdrawal requests
 * GET    /api/admin/withdrawals/:id          - Get specific withdrawal details
 * PUT    /api/admin/withdrawals/:id/approve  - Approve withdrawal request
 * PUT    /api/admin/withdrawals/:id/reject   - Reject withdrawal request
 * PUT    /api/admin/withdrawals/:id/status   - Update withdrawal status
 */

const { WithdrawalRequest, WithdrawalLog, User, Vendor } = require('../../models');
const { Op } = require('sequelize');
const logger = require('../../utils/logger');

/**
 * Get all withdrawal requests
 * @route GET /api/admin/withdrawals
 * @access Private (Admin only)
 */
exports.getAllWithdrawals = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            status = '',
            date_from = '',
            date_to = ''
        } = req.query;

        // Build search conditions
        const whereConditions = {};

        if (status) {
            whereConditions.status = status;
        }

        // Date range filter
        if (date_from || date_to) {
            whereConditions.requested_at = {};
            if (date_from) {
                whereConditions.requested_at[Op.gte] = new Date(date_from);
            }
            if (date_to) {
                whereConditions.requested_at[Op.lte] = new Date(date_to);
            }
        }

        // Calculate offset
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Fetch withdrawal requests
        const { count, rows: withdrawalRequestsData } = await WithdrawalRequest.findAndCountAll({
            where: whereConditions,
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'phone'],
                    include: [
                        {
                            model: Vendor,
                            as: 'vendor',
                            attributes: ['id', 'business_name'],
                            required: false
                        }
                    ],
                    where: search ? {
                        [Op.or]: [
                            { name: { [Op.like]: `%${search}%` } },
                            { email: { [Op.like]: `%${search}%` } },
                            { phone: { [Op.like]: `%${search}%` } }
                        ]
                    } : undefined
                },
                {
                    model: WithdrawalLog,
                    as: 'logs',
                    attributes: ['id', 'action', 'notes', 'created_at'],
                    limit: 3,
                    order: [['created_at', 'DESC']]
                }
            ],
            limit: parseInt(limit),
            offset: offset,
            order: [['requested_at', 'DESC']]
        });

        const withdrawals = withdrawalRequestsData.map(w => {
            const data = w.toJSON();
            return {
                ...data,
                user_name: data.user ? data.user.name : null,
                user_email: data.user ? data.user.email : null,
                vendor_name: data.user && data.user.vendor ? data.user.vendor.business_name : null,
                recent_logs: data.logs || []
            };
        });

        logger.api('info', 'Withdrawals fetched successfully', {
            admin_id: req.user?.id,
            total_count: count,
            filters: { status, search }
        });

        res.json({
            success: true,
            message: 'Withdrawals fetched successfully',
            data: {
                withdrawals: withdrawals,
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
        logger.error('error', 'Error fetching withdrawals', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to fetch withdrawals',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get pending withdrawal requests
 * @route GET /api/admin/withdrawals/pending
 * @access Private (Admin only)
 */
exports.getPendingWithdrawals = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = ''
        } = req.query;

        // Calculate offset
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Fetch pending withdrawal requests
        const { count, rows: withdrawalRequestsData } = await WithdrawalRequest.findAndCountAll({
            where: { status: 'pending' },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'phone'],
                    include: [
                        {
                            model: Vendor,
                            as: 'vendor',
                            attributes: ['id', 'business_name'],
                            required: false
                        }
                    ],
                    where: search ? {
                        [Op.or]: [
                            { name: { [Op.like]: `%${search}%` } },
                            { email: { [Op.like]: `%${search}%` } },
                            { phone: { [Op.like]: `%${search}%` } }
                        ]
                    } : undefined
                }
            ],
            limit: parseInt(limit),
            offset: offset,
            order: [['requested_at', 'ASC']] // Oldest first for pending requests
        });

        const withdrawals = withdrawalRequestsData.map(w => {
            const data = w.toJSON();
            return {
                ...data,
                user_name: data.user ? data.user.name : null,
                user_email: data.user ? data.user.email : null,
                vendor_name: data.user && data.user.vendor ? data.user.vendor.business_name : null
            };
        });

        logger.api('info', 'Pending withdrawals fetched successfully', {
            admin_id: req.user?.id,
            total_count: count,
            page: parseInt(page)
        });

        res.json({
            success: true,
            message: 'Pending withdrawals fetched successfully',
            data: {
                withdrawals: withdrawals,
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
        logger.error('error', 'Error fetching pending withdrawals', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending withdrawals',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get specific withdrawal details
 * @route GET /api/admin/withdrawals/:id
 * @access Private (Admin only)
 */
exports.getWithdrawalById = async (req, res) => {
    try {
        const { id } = req.params;

        const withdrawalData = await WithdrawalRequest.findByPk(id, {
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'phone'],
                    include: [
                        {
                            model: Vendor,
                            as: 'vendor',
                            attributes: ['id', 'business_name', 'gstin', 'pan_no'],
                            required: false
                        }
                    ]
                },
                {
                    model: WithdrawalLog,
                    as: 'logs',
                    attributes: ['id', 'action', 'notes', 'created_at', 'created_by'],
                    order: [['created_at', 'DESC']]
                }
            ]
        });

        if (!withdrawalData) {
            return res.status(404).json({
                success: false,
                message: 'Withdrawal request not found'
            });
        }

        const data = withdrawalData.toJSON();
        const withdrawal = {
            ...data,
            user_name: data.user ? data.user.name : null,
            user_email: data.user ? data.user.email : null,
            vendor_name: data.user && data.user.vendor ? data.user.vendor.business_name : null,
            vendor_details: data.user && data.user.vendor ? data.user.vendor : null,
            activity_logs: data.logs || []
        };

        logger.api('info', 'Withdrawal details fetched successfully', {
            admin_id: req.user?.id,
            withdrawal_id: id
        });

        res.json({
            success: true,
            message: 'Withdrawal details fetched successfully',
            data: withdrawal
        });

    } catch (error) {
        logger.error('error', 'Error fetching withdrawal details', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id,
            withdrawal_id: req.params.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to fetch withdrawal details',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Approve withdrawal request
 * @route PUT /api/admin/withdrawals/:id/approve
 * @access Private (Admin only)
 */
exports.approveWithdrawal = async (req, res) => {
    try {
        const { id } = req.params;
        const { approval_notes = '' } = req.body;

        const withdrawal = await WithdrawalRequest.findByPk(id, {
            include: [{ model: User, as: 'user', attributes: ['name', 'email'] }]
        });

        if (!withdrawal) {
            return res.status(404).json({
                success: false,
                message: 'Withdrawal request not found'
            });
        }

        if (withdrawal.status === 'approved') {
            return res.status(400).json({
                success: false,
                message: 'Withdrawal request is already approved'
            });
        }

        // Update withdrawal status to approved
        await withdrawal.update({
            status: 'approved',
            processed_at: new Date()
        });

        // Create log entry
        await WithdrawalLog.create({
            request_id: withdrawal.id,
            action: 'approved',
            notes: approval_notes,
            created_by: req.user.id,
            created_at: new Date()
        });

        logger.api('info', 'Withdrawal request approved successfully', {
            admin_id: req.user?.id,
            withdrawal_id: withdrawal.id,
            user_email: withdrawal.user ? withdrawal.user.email : null,
            amount: withdrawal.amount,
            approval_notes: approval_notes
        });

        res.json({
            success: true,
            message: 'Withdrawal request approved successfully',
            data: {
                withdrawal_id: withdrawal.id,
                user_name: withdrawal.user ? withdrawal.user.name : null,
                amount: withdrawal.amount,
                status: 'approved',
                processed_at: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('error', 'Error approving withdrawal', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id,
            withdrawal_id: req.params.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to approve withdrawal',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Reject withdrawal request
 * @route PUT /api/admin/withdrawals/:id/reject
 * @access Private (Admin only)
 */
exports.rejectWithdrawal = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejection_reason } = req.body;

        if (!rejection_reason) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required'
            });
        }

        const withdrawal = await WithdrawalRequest.findByPk(id, {
            include: [{ model: User, as: 'user', attributes: ['name', 'email'] }]
        });

        if (!withdrawal) {
            return res.status(404).json({
                success: false,
                message: 'Withdrawal request not found'
            });
        }

        if (withdrawal.status === 'rejected') {
            return res.status(400).json({
                success: false,
                message: 'Withdrawal request is already rejected'
            });
        }

        // Update withdrawal status to rejected
        await withdrawal.update({
            status: 'rejected',
            processed_at: new Date()
        });

        // Create log entry
        await WithdrawalLog.create({
            request_id: withdrawal.id,
            action: 'rejected',
            notes: rejection_reason,
            created_by: req.user.id,
            created_at: new Date()
        });

        logger.api('info', 'Withdrawal request rejected successfully', {
            admin_id: req.user?.id,
            withdrawal_id: withdrawal.id,
            user_email: withdrawal.user ? withdrawal.user.email : null,
            amount: withdrawal.amount,
            rejection_reason: rejection_reason
        });

        res.json({
            success: true,
            message: 'Withdrawal request rejected successfully',
            data: {
                withdrawal_id: withdrawal.id,
                user_name: withdrawal.user ? withdrawal.user.name : null,
                amount: withdrawal.amount,
                status: 'rejected',
                processed_at: new Date().toISOString(),
                rejection_reason: rejection_reason
            }
        });

    } catch (error) {
        logger.error('error', 'Error rejecting withdrawal', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id,
            withdrawal_id: req.params.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to reject withdrawal',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Update withdrawal status
 * @route PUT /api/admin/withdrawals/:id/status
 * @access Private (Admin only)
 */
exports.updateWithdrawalStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason = '' } = req.body;

        if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Valid status is required (pending, approved, rejected)'
            });
        }

        const withdrawal = await WithdrawalRequest.findByPk(id, {
            include: [{ model: User, as: 'user', attributes: ['name', 'email'] }]
        });

        if (!withdrawal) {
            return res.status(404).json({
                success: false,
                message: 'Withdrawal request not found'
            });
        }

        const oldStatus = withdrawal.status;

        // Update withdrawal status
        await withdrawal.update({
            status: status,
            processed_at: status !== 'pending' ? new Date() : null
        });

        // Create log entry
        await WithdrawalLog.create({
            request_id: withdrawal.id,
            action: `status_changed_to_${status}`,
            notes: reason || `Status changed from ${oldStatus} to ${status}`,
            created_by: req.user.id,
            created_at: new Date()
        });

        logger.api('info', 'Withdrawal status updated successfully', {
            admin_id: req.user?.id,
            withdrawal_id: withdrawal.id,
            old_status: oldStatus,
            new_status: status,
            reason: reason
        });

        res.json({
            success: true,
            message: 'Withdrawal status updated successfully',
            data: {
                withdrawal_id: withdrawal.id,
                user_name: withdrawal.user ? withdrawal.user.name : null,
                old_status: oldStatus,
                new_status: status,
                updated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('error', 'Error updating withdrawal status', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id,
            withdrawal_id: req.params.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to update withdrawal status',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};