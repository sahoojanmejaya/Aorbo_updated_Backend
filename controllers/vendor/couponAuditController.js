const CouponAuditService = require('../../services/couponAuditService');

/**
 * Get audit logs for a vendor
 */
const getVendorAuditLogs = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const {
            action = 'all',
            startDate,
            endDate,
            limit = 50,
            offset = 0
        } = req.query;

        const filters = {
            action,
            startDate,
            endDate,
            limit: parseInt(limit),
            offset: parseInt(offset)
        };

        const auditLogs = await CouponAuditService.getVendorAuditLogs(vendorId, filters);

        // Format the response to match the frontend expectations
        const formattedLogs = auditLogs.rows.map(log => {
            const details = JSON.parse(log.details || '{}');
            
            // Format details based on action type
            let formattedDetails = '';
            switch (log.action) {
                case 'assign':
                    formattedDetails = `coupon code: ${details.coupon_code}, trek name: ${details.trek_name}`;
                    break;
                case 'unassign':
                    formattedDetails = `coupon code: ${details.coupon_code}, previous trek: ${details.previous_trek_name}`;
                    break;
                case 'reassign':
                    formattedDetails = `coupon code: ${details.coupon_code}, from trek: ${details.from_trek_name}, to trek: ${details.to_trek_name}`;
                    break;
                case 'create':
                    formattedDetails = `coupon code: ${details.coupon_code}, discount type: ${details.discount_type}, discount value: ${details.discount_value}`;
                    break;
                case 'expire':
                    formattedDetails = `coupon code: ${details.coupon_code}, expired at: ${details.expired_at}`;
                    break;
                case 'update':
                    formattedDetails = `coupon code: ${details.coupon_code}, title: ${details.title}`;
                    break;
                case 'delete':
                    formattedDetails = `coupon code: ${details.coupon_code}, title: ${details.title}`;
                    break;
                case 'approve':
                    formattedDetails = `coupon code: ${details.coupon_code}, approved`;
                    break;
                case 'reject':
                    formattedDetails = `coupon code: ${details.coupon_code}, rejected`;
                    break;
                case 'applied':
                    formattedDetails = `coupon code: ${details.coupon_code}, applied to booking ${details.booking_id || 'N/A'}, discount: $${details.discount_amount || 'N/A'}`;
                    break;
                case 'status_change':
                    formattedDetails = `coupon code: ${details.coupon_code}, status changed from ${details.previous_status} to ${details.new_status}`;
                    break;
                default:
                    formattedDetails = `coupon code: ${details.coupon_code}`;
            }

            return {
                id: log.id,
                action: log.action,
                details: formattedDetails,
                timestamp: log.created_at,
                trek_id: log.trek_id,
                previous_trek_id: log.previous_trek_id,
                coupon: log.coupon,
                trek: log.trek,
                previous_trek: log.previous_trek
            };
        });

        // Set cache control headers to prevent caching
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        res.json({
            success: true,
            data: formattedLogs,
            total: auditLogs.count,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (error) {
        console.error('Error fetching vendor audit logs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch audit logs',
            message: error.message
        });
    }
};

/**
 * Get audit logs for a specific coupon
 */
const getCouponAuditLogs = async (req, res) => {
    try {
        const { couponId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const auditLogs = await CouponAuditService.getCouponAuditLogs(
            parseInt(couponId),
            parseInt(limit),
            parseInt(offset)
        );

        res.json({
            success: true,
            data: auditLogs.rows,
            total: auditLogs.count,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (error) {
        console.error('Error fetching coupon audit logs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch coupon audit logs',
            message: error.message
        });
    }
};

/**
 * Get available actions for filtering
 */
const getAvailableActions = async (req, res) => {
    try {
        const actions = [
            { value: 'all', label: 'All Actions' },
            { value: 'create', label: 'Create' },
            { value: 'update', label: 'Update' },
            { value: 'delete', label: 'Delete' },
            { value: 'assign', label: 'Assign' },
            { value: 'unassign', label: 'Unassign' },
            { value: 'reassign', label: 'Reassign' },
            { value: 'expire', label: 'Expire' },
            { value: 'approve', label: 'Approve' },
            { value: 'reject', label: 'Reject' }
        ];

        res.json({
            success: true,
            data: actions
        });

    } catch (error) {
        console.error('Error fetching available actions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch available actions',
            message: error.message
        });
    }
};

module.exports = {
    getVendorAuditLogs,
    getCouponAuditLogs,
    getAvailableActions
};
