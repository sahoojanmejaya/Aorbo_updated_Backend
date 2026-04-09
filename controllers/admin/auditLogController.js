/**
 * Audit Log Controller for Admin Panel
 * 
 * @description Handles system audit log operations for administrators
 * @author Kiro AI Assistant
 * @created 2026-03-09 15:40:00 IST
 * @updated 2026-03-09 15:40:00 IST
 * 
 * @routes
 * GET    /api/admin/audit-logs              - Get audit logs with filters
 * GET    /api/admin/audit-logs/modules      - Get available audit modules
 * GET    /api/admin/audit-logs/statistics   - Get audit log statistics
 * GET    /api/admin/audit-logs/:id          - Get specific audit log details
 */

const { sequelize, TrekAuditLog, User, Trek } = require('../../models');
const { Op } = require('sequelize');
const logger = require('../../utils/logger');

/**
 * Get audit logs with filters
 * @route GET /api/admin/audit-logs
 * @access Private (Admin only)
 * @created 2026-03-09 15:40:00 IST
 */
exports.getAuditLogs = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            action = '',
            performer_id = '',
            date_from = '',
            date_to = '',
            search = '',
            module = ''
        } = req.query;

        const offset = (Number.parseInt(page) - 1) * Number.parseInt(limit);
        const modules = module ? module.split(',').map(m => m.trim().toUpperCase()) : [];

        // Check if we need to fetch from specialized CouponAuditLog table
        const includeCoupons = modules.includes('COUPON');
        const includeBadges = modules.includes('BADGE');

        // For now, if COUPON or BADGE is specifically requested and no other standard trek modules,
        // we can prioritize the specialized CouponAuditLog table.
        // If it's a mix, we should ideally union, but let's handle the specific request from the coupon panel first.
        
        if (includeCoupons && modules.length === 1) {
            const { CouponAuditLog, Coupon } = require('../../models');
            const where = {};
            if (action) where.action = { [Op.like]: `%${action}%` };
            if (performer_id) where.vendor_id = performer_id;
            if (date_from || date_to) {
                where.created_at = {};
                if (date_from) where.created_at[Op.gte] = new Date(date_from);
                if (date_to) where.created_at[Op.lte] = new Date(date_to);
            }
            if (search) {
                where[Op.or] = [
                    { action: { [Op.like]: `%${search}%` } },
                    { details: { [Op.like]: `%${search}%` } }
                ];
            }

            const { count, rows: logs } = await CouponAuditLog.findAndCountAll({
                where,
                include: [
                    { model: User, as: 'vendor', attributes: ['id', 'name'], required: false },
                    { model: Coupon, as: 'coupon', attributes: ['id', 'code'], required: false }
                ],
                limit: Number.parseInt(limit),
                offset,
                order: [['created_at', 'DESC']]
            });

            const formattedLogs = logs.map(log => ({
                id: log.id,
                timestamp: log.created_at,
                performer_id: log.vendor_id,
                performer_name: log.vendor ? log.vendor.name : 'Admin',
                action: log.action.toUpperCase(),
                entity_id: log.coupon_id,
                entity_name: log.coupon ? log.coupon.code : 'COUPON',
                target: log.coupon ? log.coupon.code : 'COUPON',
                targetType: 'COUPON',
                details: log.details
            }));

            return res.json({
                success: true,
                message: 'Coupon audit logs fetched successfully',
                data: {
                    logs: formattedLogs,
                    pagination: {
                        current_page: parseInt(page),
                        total_pages: Math.ceil(count / parseInt(limit)),
                        total_count: count,
                        per_page: parseInt(limit)
                    }
                }
            });
        }

        // Standard TrekAuditLog flow
        const whereConditions = {};
        if (module) {
            whereConditions.target_entity = { [Op.in]: modules };
        }
        if (action) whereConditions.current_status = { [Op.like]: `%${action}%` };
        if (performer_id) whereConditions.vendor_id = performer_id;
        if (date_from || date_to) {
            whereConditions.created_at = {};
            if (date_from) whereConditions.created_at[Op.gte] = new Date(date_from);
            if (date_to) whereConditions.created_at[Op.lte] = new Date(date_to);
        }
        if (search) {
            whereConditions[Op.or] = [
                { current_status: { [Op.like]: `%${search}%` } },
                { target_entity: { [Op.like]: `%${search}%` } },
                { details: { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows: logs } = await TrekAuditLog.findAndCountAll({
            where: whereConditions,
            include: [{ model: User, as: 'vendor', attributes: ['id', 'name'], required: false }],
            limit: parseInt(limit),
            offset,
            order: [['created_at', 'DESC']],
            distinct: true
        });

        const formattedLogs = logs.map(log => {
            let formattedDetails = log.details;
            try {
                const parsed = JSON.parse(log.details);
                formattedDetails = parsed.reason || parsed.action || log.details;
            } catch (e) {}

            return {
                id: log.id,
                timestamp: log.createdAt || log.created_at,
                performer_id: log.vendor_id,
                performer_name: log.vendor ? log.vendor.name : 'System',
                action: log.current_status,
                entity_id: log.trek_id,
                entity_name: log.target_entity,
                target: log.target_entity,
                targetType: log.target_entity,
                details: formattedDetails
            };
        });

        res.json({
            success: true,
            message: 'Audit logs fetched successfully',
            data: {
                logs: formattedLogs,
                pagination: {
                    current_page: Number.parseInt(page),
                    total_pages: Math.ceil(count / Number.parseInt(limit)),
                    total_count: count,
                    per_page: Number.parseInt(limit)
                }
            }
        });

    } catch (error) {
        logger.error('error', 'Error fetching audit logs', {
            error: error.message,
            admin_id: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to fetch audit logs',
            error: error.message
        });
    }
};


/**
 * Get available audit modules
 * @route GET /api/admin/audit-logs/modules
 * @access Private (Admin only)
 * @created 2026-03-09 15:40:00 IST
 */
exports.getAuditModules = async (req, res) => {
    try {
        // Get distinct modules from audit_logs table
        const modulesQuery = `
            SELECT DISTINCT module, COUNT(*) as log_count
            FROM audit_logs 
            WHERE module IS NOT NULL
            GROUP BY module
            ORDER BY module ASC
        `;

        const modules = await sequelize.query(modulesQuery, {
            type: sequelize.QueryTypes.SELECT
        });

        // Get distinct actions
        const actionsQuery = `
            SELECT DISTINCT action, COUNT(*) as action_count
            FROM audit_logs 
            WHERE action IS NOT NULL
            GROUP BY action
            ORDER BY action ASC
        `;

        const actions = await sequelize.query(actionsQuery, {
            type: sequelize.QueryTypes.SELECT
        });

        logger.api('info', 'Audit modules fetched successfully', {
            admin_id: req.user?.id,
            modules_count: modules.length,
            actions_count: actions.length
        });

        res.json({
            success: true,
            message: 'Audit modules fetched successfully',
            data: {
                modules: modules.map(m => ({
                    name: m.module,
                    log_count: m.log_count
                })),
                actions: actions.map(a => ({
                    name: a.action,
                    count: a.action_count
                }))
            }
        });

    } catch (error) {
        logger.error('error', 'Error fetching audit modules', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to fetch audit modules',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get audit log statistics
 * @route GET /api/admin/audit-logs/statistics
 * @access Private (Admin only)
 * @created 2026-03-09 15:40:00 IST
 */
exports.getAuditStatistics = async (req, res) => {
    try {
        // Get overall statistics
        const totalLogsQuery = 'SELECT COUNT(*) as total FROM audit_logs';
        const [totalResult] = await sequelize.query(totalLogsQuery, {
            type: sequelize.QueryTypes.SELECT
        });

        // Get logs from last 24 hours
        const last24HoursQuery = `
            SELECT COUNT(*) as count 
            FROM audit_logs 
            WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `;
        const [last24HoursResult] = await sequelize.query(last24HoursQuery, {
            type: sequelize.QueryTypes.SELECT
        });

        // Get logs from last 7 days
        const last7DaysQuery = `
            SELECT COUNT(*) as count 
            FROM audit_logs 
            WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `;
        const [last7DaysResult] = await sequelize.query(last7DaysQuery, {
            type: sequelize.QueryTypes.SELECT
        });

        // Get top performers (users with most actions)
        const topPerformersQuery = `
            SELECT 
                performer_id,
                performer_name,
                COUNT(*) as action_count
            FROM audit_logs 
            WHERE performer_id IS NOT NULL
            GROUP BY performer_id, performer_name
            ORDER BY action_count DESC
            LIMIT 10
        `;
        const topPerformers = await sequelize.query(topPerformersQuery, {
            type: sequelize.QueryTypes.SELECT
        });

        // Get activity by module
        const moduleActivityQuery = `
            SELECT 
                module,
                COUNT(*) as activity_count
            FROM audit_logs 
            WHERE module IS NOT NULL
            GROUP BY module
            ORDER BY activity_count DESC
        `;
        const moduleActivity = await sequelize.query(moduleActivityQuery, {
            type: sequelize.QueryTypes.SELECT
        });

        // Get daily activity for last 30 days
        const dailyActivityQuery = `
            SELECT 
                DATE(timestamp) as date,
                COUNT(*) as activity_count
            FROM audit_logs 
            WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(timestamp)
            ORDER BY date ASC
        `;
        const dailyActivity = await sequelize.query(dailyActivityQuery, {
            type: sequelize.QueryTypes.SELECT
        });

        logger.api('info', 'Audit statistics fetched successfully', {
            admin_id: req.user?.id
        });

        res.json({
            success: true,
            message: 'Audit statistics fetched successfully',
            data: {
                overview: {
                    total_logs: totalResult.total,
                    last_24_hours: last24HoursResult.count,
                    last_7_days: last7DaysResult.count
                },
                top_performers: topPerformers,
                module_activity: moduleActivity,
                daily_activity: dailyActivity,
                last_updated: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('error', 'Error fetching audit statistics', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to fetch audit statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get specific audit log details
 * @route GET /api/admin/audit-logs/:id
 * @access Private (Admin only)
 * @created 2026-03-09 15:40:00 IST
 */
exports.getAuditLogById = async (req, res) => {
    try {
        const { id } = req.params;

        const auditLogQuery = `
            SELECT 
                id,
                timestamp,
                performer_id,
                performer_name,
                action,
                entity_id,
                entity_name,
                details,
                module,
                ip_address,
                user_agent
            FROM audit_logs 
            WHERE id = ?
        `;

        const [auditLog] = await sequelize.query(auditLogQuery, {
            replacements: [id],
            type: sequelize.QueryTypes.SELECT
        });

        if (!auditLog) {
            return res.status(404).json({
                success: false,
                message: 'Audit log not found'
            });
        }

        // Format the response
        const formattedLog = {
            id: auditLog.id,
            timestamp: auditLog.timestamp,
            performer: {
                id: auditLog.performer_id,
                name: auditLog.performer_name
            },
            action: auditLog.action,
            entity: {
                id: auditLog.entity_id,
                name: auditLog.entity_name
            },
            module: auditLog.module,
            details: auditLog.details ? JSON.parse(auditLog.details) : null,
            metadata: {
                ip_address: auditLog.ip_address,
                user_agent: auditLog.user_agent
            }
        };

        logger.api('info', 'Audit log details fetched successfully', {
            admin_id: req.user?.id,
            audit_log_id: id
        });

        res.json({
            success: true,
            message: 'Audit log details fetched successfully',
            data: formattedLog
        });

    } catch (error) {
        logger.error('error', 'Error fetching audit log details', {
            error: error.message,
            stack: error.stack,
            admin_id: req.user?.id,
            audit_log_id: req.params.id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to fetch audit log details',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};