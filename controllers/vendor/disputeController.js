const { IssueReport, Booking, Customer, Trek, Vendor, User } = require("../../models");
const { Op } = require("sequelize");
const { roundAmount } = require("../../utils/amountUtils");

/**
 * Get all disputes for a specific vendor with filtering and pagination
 * GET /api/vendor/disputes
 */
const getVendorDisputes = async (req, res) => {
    try {
        console.log('=== VENDOR DISPUTES LIST CALLED ===');
        const vendorId = req.user.id; // Get vendor ID from authenticated user
        console.log('Vendor ID:', vendorId);
        const {
            page = 1,
            limit = 10,
            status,
            priority,
            issue_type,
            search,
            sort_by = 'created_at',
            sort_order = 'DESC'
        } = req.query;

        const offset = (page - 1) * limit;

        // Build where clause
        const whereClause = {};
        
        if (status) {
            whereClause.status = status;
        }
        
        if (priority) {
            whereClause.priority = priority;
        }
        
        if (issue_type) {
            whereClause.issue_type = issue_type;
        }

        // Build search clause
        const searchClause = {};
        if (search) {
            searchClause[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { phone_number: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows: disputes } = await IssueReport.findAndCountAll({
            where: { ...whereClause, ...searchClause },
            include: [
                {
                    model: Booking,
                    as: "booking",
                    where: { vendor_id: vendorId }, // Only show disputes for this vendor's bookings
                    required: true, // Must have a booking
                    include: [
                        { model: Trek, as: "trek" },
                        { model: Vendor, as: "vendor" },
                        { model: Customer, as: "customer" }
                    ]
                },
                { model: Customer, as: "customer" },
                { model: User, as: "assignedUser" }
            ],
            order: [[sort_by, sort_order]],
            limit: parseInt(limit),
            offset: parseInt(offset),
            distinct: true // Important: count distinct rows to avoid join multiplication
        });

        // Calculate summary statistics for this vendor only
        // IMPORTANT: Use the same query structure as findAndCountAll to ensure count consistency
        // The base include structure must match to avoid discrepancies from joins
        const baseIncludeStructure = [
            {
                model: Booking,
                as: "booking",
                where: { vendor_id: vendorId },
                required: true,
                include: [
                    { model: Trek, as: "trek" },
                    { model: Vendor, as: "vendor" },
                    { model: Customer, as: "customer" }
                ]
            },
            { model: Customer, as: "customer" },
            { model: User, as: "assignedUser" }
        ];

        // Apply search filter to summary stats if provided (for consistency)
        const summaryWhereClause = search ? { ...searchClause } : {};

        // Use findAndCountAll to get accurate count with same query structure
        const { count: vendorDisputesCount } = await IssueReport.findAndCountAll({
            where: summaryWhereClause,
            include: baseIncludeStructure,
            distinct: true // Important: count distinct rows to avoid join multiplication
        });

        const { count: openDisputes } = await IssueReport.findAndCountAll({ 
            where: { ...summaryWhereClause, status: 'open' },
            include: baseIncludeStructure,
            distinct: true
        });

        const { count: inProgressDisputes } = await IssueReport.findAndCountAll({ 
            where: { ...summaryWhereClause, status: 'in_progress' },
            include: baseIncludeStructure,
            distinct: true
        });

        const { count: escalatedDisputes } = await IssueReport.findAndCountAll({ 
            where: { ...summaryWhereClause, priority: 'urgent' },
            include: baseIncludeStructure,
            distinct: true
        });

        // Fetch disputed_amount for each dispute using raw SQL
        const disputeIds = disputes.map(d => d.id);
        const disputedAmounts = {};
        if (disputeIds.length > 0) {
            const disputedAmountResults = await IssueReport.sequelize.query(
                'SELECT id, disputed_amount FROM issue_reports WHERE id IN (:ids)',
                {
                    replacements: { ids: disputeIds },
                    type: IssueReport.sequelize.QueryTypes.SELECT
                }
            );
            disputedAmountResults.forEach(result => {
                disputedAmounts[result.id] = result.disputed_amount;
            });
        }

        // Calculate total disputed amount for this vendor
        const totalDisputedAmountResult = await IssueReport.sequelize.query(
            `SELECT SUM(ir.disputed_amount) as total 
             FROM issue_reports ir 
             INNER JOIN bookings b ON ir.booking_id = b.id 
             WHERE b.vendor_id = :vendorId AND ir.disputed_amount IS NOT NULL`,
            {
                replacements: { vendorId },
                type: IssueReport.sequelize.QueryTypes.SELECT
            }
        );
        const totalDisputedAmount = totalDisputedAmountResult[0]?.total || 0;

        // Format disputes data
        const formattedDisputes = disputes.map(dispute => ({
            id: dispute.id,
            dispute_id: dispute.dispute_id,
            name: dispute.name,
            email: dispute.email,
            phone_number: dispute.phone_number,
            issue_type: dispute.issue_type,
            issue_category: dispute.issue_category,
            description: dispute.description,
            status: dispute.status,
            priority: dispute.priority,
            disputed_amount: disputedAmounts[dispute.id] !== undefined
                ? roundAmount(parseFloat(disputedAmounts[dispute.id] || 0))
                : null,
            created_at: dispute.created_at,
            updated_at: dispute.updated_at,
            resolved_at: dispute.resolved_at,
            assigned_to: dispute.assigned_to,
            resolution_notes: dispute.resolution_notes,
            booking_info: dispute.booking ? {
                id: dispute.booking.id,
                trek_name: dispute.booking.trek?.title || 'N/A',
                trek_id: dispute.booking.trek?.mtr_id || 'N/A',
                vendor_name: dispute.booking.vendor?.business_name || 
                           (dispute.booking.vendor?.company_info ? 
                            (() => {
                                try {
                                    return JSON.parse(dispute.booking.vendor.company_info).company_name;
                                } catch (e) {
                                    return 'N/A';
                                }
                            })() : 'N/A'),
                booking_date: dispute.booking.created_at,
                final_amount: roundAmount(parseFloat(dispute.booking.final_amount || 0))
            } : null,
            customer_info: dispute.customer ? {
                id: dispute.customer.id,
                name: dispute.customer.name,
                email: dispute.customer.email,
                phone: dispute.customer.phone
            } : null
        }));

        res.json({
            success: true,
            data: {
                disputes: formattedDisputes,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(count / limit),
                    totalDisputes: count,
                    hasNext: page * limit < count,
                    hasPrev: page > 1
                },
                summary: {
                    total: vendorDisputesCount,
                    open: openDisputes,
                    inProgress: inProgressDisputes,
                    escalated: escalatedDisputes,
                    resolved: vendorDisputesCount - openDisputes - inProgressDisputes,
                    closed: 0,
                    disputedAmount: roundAmount(parseFloat(totalDisputedAmount || 0))
                }
            }
        });

    } catch (error) {
        console.error("Error fetching vendor disputes:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch disputes",
            error: error.message || "Something went wrong"
        });
    }
};

/**
 * Get dispute statistics for vendor dashboard
 * GET /api/vendor/disputes/stats
 */
const getVendorDisputeStats = async (req, res) => {
    try {
        console.log('=== VENDOR DISPUTE STATS CALLED ===');
        const vendorId = req.user.id; // Get vendor ID from authenticated user
        console.log('Vendor ID:', vendorId);

        const stats = await IssueReport.findAll({
            attributes: [
                'status',
                'priority',
                [IssueReport.sequelize.fn('COUNT', IssueReport.sequelize.col('id')), 'count']
            ],
            include: [
                {
                    model: Booking,
                    as: "booking",
                    where: { vendor_id: vendorId },
                    required: true
                }
            ],
            group: ['status', 'priority'],
            raw: true
        });

        const totalDisputes = await IssueReport.count({
            include: [
                {
                    model: Booking,
                    as: "booking",
                    where: { vendor_id: vendorId },
                    required: true
                }
            ]
        });

        const openDisputes = await IssueReport.count({ 
            where: { status: 'open' },
            include: [
                {
                    model: Booking,
                    as: "booking",
                    where: { vendor_id: vendorId },
                    required: true
                }
            ]
        });

        const inProgressDisputes = await IssueReport.count({ 
            where: { status: 'in_progress' },
            include: [
                {
                    model: Booking,
                    as: "booking",
                    where: { vendor_id: vendorId },
                    required: true
                }
            ]
        });

        const resolvedDisputes = await IssueReport.count({ 
            where: { status: 'resolved' },
            include: [
                {
                    model: Booking,
                    as: "booking",
                    where: { vendor_id: vendorId },
                    required: true
                }
            ]
        });

        const closedDisputes = await IssueReport.count({ 
            where: { status: 'closed' },
            include: [
                {
                    model: Booking,
                    as: "booking",
                    where: { vendor_id: vendorId },
                    required: true
                }
            ]
        });

        const escalatedDisputes = await IssueReport.count({ 
            where: { priority: 'urgent' },
            include: [
                {
                    model: Booking,
                    as: "booking",
                    where: { vendor_id: vendorId },
                    required: true
                }
            ]
        });

        // Calculate disputed amount from the disputed_amount field using raw SQL for this vendor
        const disputedAmountResult = await IssueReport.sequelize.query(
            `SELECT SUM(ir.disputed_amount) as total 
             FROM issue_reports ir 
             INNER JOIN bookings b ON ir.booking_id = b.id 
             WHERE b.vendor_id = :vendorId AND ir.disputed_amount IS NOT NULL`,
            {
                replacements: { vendorId },
                type: IssueReport.sequelize.QueryTypes.SELECT
            }
        );
        const disputedAmount = disputedAmountResult[0]?.total || 0;

        res.json({
            success: true,
            data: {
                total: totalDisputes,
                open: openDisputes,
                inProgress: inProgressDisputes,
                resolved: resolvedDisputes,
                closed: closedDisputes,
                escalated: escalatedDisputes,
                disputedAmount: roundAmount(parseFloat(disputedAmount || 0)),
                statusBreakdown: stats.reduce((acc, stat) => {
                    if (!acc[stat.status]) {
                        acc[stat.status] = 0;
                    }
                    acc[stat.status] += parseInt(stat.count);
                    return acc;
                }, {}),
                priorityBreakdown: stats.reduce((acc, stat) => {
                    if (!acc[stat.priority]) {
                        acc[stat.priority] = 0;
                    }
                    acc[stat.priority] += parseInt(stat.count);
                    return acc;
                }, {})
            }
        });

    } catch (error) {
        console.error("Error fetching vendor dispute stats:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch dispute statistics",
            error: error.message || "Something went wrong"
        });
    }
};

/**
 * Get dispute by ID for vendor
 * GET /api/vendor/disputes/:id
 */
const getVendorDisputeById = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user.id; // Get vendor ID from authenticated user

        const dispute = await IssueReport.findOne({
            where: { id },
            include: [
                {
                    model: Booking,
                    as: "booking",
                    where: { vendor_id: vendorId }, // Ensure this dispute belongs to this vendor
                    required: true,
                    include: [
                        { model: Trek, as: "trek" },
                        { model: Vendor, as: "vendor" },
                        { model: Customer, as: "customer" }
                    ]
                },
                { model: Customer, as: "customer" },
                { model: User, as: "assignedUser" }
            ]
        });

        if (!dispute) {
            return res.status(404).json({
                success: false,
                message: "Dispute not found or access denied"
            });
        }

        // Fetch disputed_amount using raw SQL
        const disputedAmountResult = await IssueReport.sequelize.query(
            'SELECT disputed_amount FROM issue_reports WHERE id = :id',
            {
                replacements: { id: dispute.id },
                type: IssueReport.sequelize.QueryTypes.SELECT
            }
        );
        const disputedAmount = disputedAmountResult[0]?.disputed_amount || null;

        res.json({
            success: true,
            data: {
                id: dispute.id,
                dispute_id: dispute.dispute_id,
                name: dispute.name,
                email: dispute.email,
                phone_number: dispute.phone_number,
                issue_type: dispute.issue_type,
                issue_category: dispute.issue_category,
                description: dispute.description,
                status: dispute.status,
                priority: dispute.priority,
                disputed_amount: disputedAmount,
                created_at: dispute.created_at,
                updated_at: dispute.updated_at,
                resolved_at: dispute.resolved_at,
                assigned_to: dispute.assigned_to,
                resolution_notes: dispute.resolution_notes,
                booking_info: dispute.booking ? {
                    id: dispute.booking.id,
                    trek_name: dispute.booking.trek?.title || 'N/A',
                    trek_id: dispute.booking.trek?.mtr_id || 'N/A',
                    vendor_name: dispute.booking.vendor?.business_name || 
                               (dispute.booking.vendor?.company_info ? 
                                (() => {
                                    try {
                                        return JSON.parse(dispute.booking.vendor.company_info).company_name;
                                    } catch (e) {
                                        return 'N/A';
                                    }
                                })() : 'N/A'),
                    booking_date: dispute.booking.created_at,
                    final_amount: dispute.booking.final_amount
                } : null,
                customer_info: dispute.customer ? {
                    id: dispute.customer.id,
                    name: dispute.customer.name,
                    email: dispute.customer.email,
                    phone: dispute.customer.phone
                } : null
            }
        });

    } catch (error) {
        console.error("Error fetching vendor dispute:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch dispute",
            error: error.message || "Something went wrong"
        });
    }
};


module.exports = {
    getVendorDisputes,
    getVendorDisputeStats,
    getVendorDisputeById
};
