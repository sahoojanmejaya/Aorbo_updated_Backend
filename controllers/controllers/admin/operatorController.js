/**
 * Operator Controller for Admin Panel
 * 
 * @description Handles operator/staff management operations for administrators
 * @author Kiro AI Assistant
 * @created 2026-03-09 15:45:00 IST
 * @updated 2026-03-11 00:47:00 IST
 * 
 * @routes
 * GET    /api/admin/operators              - Get all operators with filters
 * GET    /api/admin/operators/statistics   - Get operator statistics
 * GET    /api/admin/operators/:id          - Get specific operator details
 * POST   /api/admin/operators              - Create new operator
 * PUT    /api/admin/operators/:id          - Update operator details
 * PUT    /api/admin/operators/:id/status   - Update operator status
 * DELETE /api/admin/operators/:id          - Delete/Deactivate operator
 */

const { User, Role, Permission } = require('../../models');
const { Op } = require('sequelize');
const logger = require('../../utils/logger');
const bcrypt = require('bcryptjs');

// Staff/admin role IDs (adjust these to match your roles table)
const STAFF_ROLE_IDS = [1, 2, 3, 4, 5, 6]; // admin, operator, support, technical, account, agent

/**
 * Get all operators with filters
 * @route GET /api/admin/operators
 * @access Private (Admin only)
 */
exports.getOperators = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            status = '',
            role_id = '',
            date_from = '',
            date_to = ''
        } = req.query;

        // Build search conditions
        const whereConditions = {
            roleId: { [Op.in]: STAFF_ROLE_IDS }
        };

        if (search) {
            whereConditions[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { phone: { [Op.like]: `%${search}%` } }
            ];
        }

        if (status) {
            whereConditions.status = status;
        }

        if (role_id) {
            whereConditions.roleId = parseInt(role_id);
        }

        // Date range filter
        if (date_from || date_to) {
            whereConditions.createdAt = {};
            if (date_from) {
                whereConditions.createdAt[Op.gte] = new Date(date_from);
            }
            if (date_to) {
                whereConditions.createdAt[Op.lte] = new Date(date_to);
            }
        }

        // Calculate offset
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Fetch operators
        const { count, rows: operators } = await User.findAndCountAll({
            where: whereConditions,
            attributes: [
                'id', 'name', 'email', 'phone', 'roleId', 'status',
                'prefix', 'createdAt', 'updatedAt'
            ],
            include: [
                {
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name', 'description'],
                    required: false
                }
            ],
            limit: parseInt(limit),
            offset: offset,
            order: [['createdAt', 'DESC']]
        });

        // Format response data
        const formattedOperators = operators.map(operator => ({
            id: operator.id,
            name: operator.name,
            email: operator.email,
            phone: operator.phone,
            role_id: operator.roleId,
            role: operator.role?.name || 'Unknown',
            status: operator.status,
            prefix: operator.prefix,
            created_at: operator.createdAt,
            updated_at: operator.updatedAt,
            role_details: operator.role ? {
                id: operator.role.id,
                name: operator.role.name,
                description: operator.role.description
            } : null
        }));

        logger.api('info', 'Operators fetched successfully', {
            admin_id: req.user?.id,
            total_count: count,
            filters: { status, role_id, search }
        });

        res.json({
            success: true,
            message: 'Operators fetched successfully',
            data: {
                operators: formattedOperators,
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
        logger.error('error', 'Error fetching operators', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to fetch operators',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get operator statistics
 * @route GET /api/admin/operators/statistics
 * @access Private (Admin only)
 */
exports.getOperatorStatistics = async (req, res) => {
    try {
        // Get overall operator statistics
        const totalOperators = await User.count({
            where: { roleId: { [Op.in]: STAFF_ROLE_IDS } }
        });

        const activeOperators = await User.count({
            where: {
                roleId: { [Op.in]: STAFF_ROLE_IDS },
                status: 'active'
            }
        });

        const inactiveOperators = await User.count({
            where: {
                roleId: { [Op.in]: STAFF_ROLE_IDS },
                status: 'inactive'
            }
        });

        // Get operators by role
        const operatorsByRole = await User.findAll({
            attributes: [
                'roleId',
                [require('sequelize').fn('COUNT', require('sequelize').col('User.id')), 'count']
            ],
            where: { roleId: { [Op.in]: STAFF_ROLE_IDS } },
            include: [
                {
                    model: Role,
                    as: 'role',
                    attributes: ['name'],
                    required: false
                }
            ],
            group: ['roleId', 'role.id', 'role.name'],
            raw: true,
            nest: true
        });

        // Get monthly registration trend (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyTrend = await User.findAll({
            attributes: [
                [require('sequelize').fn('DATE_FORMAT', require('sequelize').col('User.created_at'), '%Y-%m'), 'month'],
                [require('sequelize').fn('COUNT', require('sequelize').col('User.id')), 'count']
            ],
            where: {
                roleId: { [Op.in]: STAFF_ROLE_IDS },
                createdAt: { [Op.gte]: sixMonthsAgo }
            },
            group: [require('sequelize').fn('DATE_FORMAT', require('sequelize').col('User.created_at'), '%Y-%m')],
            order: [[require('sequelize').fn('DATE_FORMAT', require('sequelize').col('User.created_at'), '%Y-%m'), 'ASC']],
            raw: true
        });

        logger.api('info', 'Operator statistics fetched successfully', {
            admin_id: req.user?.id
        });

        res.json({
            success: true,
            message: 'Operator statistics fetched successfully',
            data: {
                overview: {
                    total_operators: totalOperators,
                    active_operators: activeOperators,
                    inactive_operators: inactiveOperators,
                    recent_logins: 0
                },
                by_role: operatorsByRole,
                monthly_trend: monthlyTrend,
                last_updated: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('error', 'Error fetching operator statistics', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to fetch operator statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get specific operator details
 * @route GET /api/admin/operators/:id
 * @access Private (Admin only)
 */
exports.getOperatorById = async (req, res) => {
    try {
        const { id } = req.params;

        const operator = await User.findByPk(id, {
            attributes: [
                'id', 'name', 'email', 'phone', 'roleId', 'status',
                'prefix', 'createdAt', 'updatedAt'
            ],
            include: [
                {
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name', 'description'],
                    required: false
                }
            ]
        });

        if (!operator) {
            return res.status(404).json({
                success: false,
                message: 'Operator not found'
            });
        }

        // Check if user is actually a staff member
        if (!STAFF_ROLE_IDS.includes(operator.roleId)) {
            return res.status(404).json({
                success: false,
                message: 'Operator not found'
            });
        }

        logger.api('info', 'Operator details fetched successfully', {
            admin_id: req.user?.id,
            operator_id: id
        });

        res.json({
            success: true,
            message: 'Operator details fetched successfully',
            data: {
                id: operator.id,
                name: operator.name,
                email: operator.email,
                phone: operator.phone,
                role_id: operator.roleId,
                role: operator.role?.name || 'Unknown',
                status: operator.status,
                prefix: operator.prefix,
                created_at: operator.createdAt,
                updated_at: operator.updatedAt,
                role_details: operator.role ? {
                    id: operator.role.id,
                    name: operator.role.name,
                    description: operator.role.description
                } : null
            }
        });

    } catch (error) {
        logger.error('error', 'Error fetching operator details', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id,
            operator_id: req.params.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to fetch operator details',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Create new operator
 * @route POST /api/admin/operators
 * @access Private (Admin only)
 */
exports.createOperator = async (req, res) => {
    try {
        const { name, email, phone, role_id, password } = req.body;

        // Validate required fields
        if (!name || !email || !role_id || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, role_id, and password are required'
            });
        }

        // Validate role_id
        if (!STAFF_ROLE_IDS.includes(parseInt(role_id))) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role_id for operator'
            });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create operator
        const operator = await User.create({
            name,
            email,
            phone,
            roleId: parseInt(role_id),
            passwordHash: hashedPassword,
            status: 'active'
        });

        logger.api('info', 'Operator created successfully', {
            admin_id: req.user?.id,
            operator_id: operator.id,
            operator_email: email,
            operator_role_id: role_id
        });

        res.status(201).json({
            success: true,
            message: 'Operator created successfully',
            data: {
                id: operator.id,
                name: operator.name,
                email: operator.email,
                phone: operator.phone,
                role_id: operator.roleId,
                status: operator.status,
                created_at: operator.createdAt
            }
        });

    } catch (error) {
        logger.error('error', 'Error creating operator', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to create operator',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Update operator details
 * @route PUT /api/admin/operators/:id
 * @access Private (Admin only)
 */
exports.updateOperator = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, role_id } = req.body;

        const operator = await User.findByPk(id);
        if (!operator) {
            return res.status(404).json({
                success: false,
                message: 'Operator not found'
            });
        }

        // Check if user is actually a staff member
        if (!STAFF_ROLE_IDS.includes(operator.roleId)) {
            return res.status(404).json({
                success: false,
                message: 'Operator not found'
            });
        }

        // Validate role_id if provided
        if (role_id && !STAFF_ROLE_IDS.includes(parseInt(role_id))) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role_id for operator'
            });
        }

        // Check if email already exists (excluding current operator)
        if (email && email !== operator.email) {
            const existingUser = await User.findOne({
                where: {
                    email,
                    id: { [Op.ne]: id }
                }
            });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already exists'
                });
            }
        }

        // Update operator
        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (phone) updateData.phone = phone;
        if (role_id) updateData.roleId = parseInt(role_id);

        await operator.update(updateData);

        logger.api('info', 'Operator updated successfully', {
            admin_id: req.user?.id,
            operator_id: id,
            updated_fields: Object.keys(updateData)
        });

        res.json({
            success: true,
            message: 'Operator updated successfully',
            data: {
                id: operator.id,
                name: operator.name,
                email: operator.email,
                phone: operator.phone,
                role_id: operator.roleId,
                status: operator.status,
                updated_at: operator.updatedAt
            }
        });

    } catch (error) {
        logger.error('error', 'Error updating operator', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id,
            operator_id: req.params.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to update operator',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Update operator status
 * @route PUT /api/admin/operators/:id/status
 * @access Private (Admin only)
 */
exports.updateOperatorStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        // Validate status
        const validStatuses = ['active', 'inactive', 'locked'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
            });
        }

        const operator = await User.findByPk(id);
        if (!operator) {
            return res.status(404).json({
                success: false,
                message: 'Operator not found'
            });
        }

        // Check if user is actually a staff member
        if (!STAFF_ROLE_IDS.includes(operator.roleId)) {
            return res.status(404).json({
                success: false,
                message: 'Operator not found'
            });
        }

        const oldStatus = operator.status;

        // Update operator status
        await operator.update({ status });

        logger.api('info', 'Operator status updated successfully', {
            admin_id: req.user?.id,
            operator_id: id,
            old_status: oldStatus,
            new_status: status,
            reason: reason || 'No reason provided'
        });

        res.json({
            success: true,
            message: 'Operator status updated successfully',
            data: {
                operator_id: id,
                old_status: oldStatus,
                new_status: status,
                updated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('error', 'Error updating operator status', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id,
            operator_id: req.params.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to update operator status',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Delete/Deactivate operator
 * @route DELETE /api/admin/operators/:id
 * @access Private (Admin only)
 */
exports.deleteOperator = async (req, res) => {
    try {
        const { id } = req.params;

        const operator = await User.findByPk(id);
        if (!operator) {
            return res.status(404).json({
                success: false,
                message: 'Operator not found'
            });
        }

        // Check if user is actually a staff member
        if (!STAFF_ROLE_IDS.includes(operator.roleId)) {
            return res.status(404).json({
                success: false,
                message: 'Operator not found'
            });
        }

        // Soft delete - just deactivate the operator
        await operator.update({ status: 'inactive' });

        logger.api('info', 'Operator deactivated successfully', {
            admin_id: req.user?.id,
            operator_id: id,
            operator_email: operator.email
        });

        res.json({
            success: true,
            message: 'Operator deactivated successfully',
            data: {
                operator_id: id,
                status: 'inactive',
                deactivated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('error', 'Error deleting operator', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id,
            operator_id: req.params.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to delete operator',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};