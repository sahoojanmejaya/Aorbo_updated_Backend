const { IssueReport, Booking, Customer, Trek, Vendor, User } = require("../../models");
const { Op } = require("sequelize");

/**
 * Get all disputes with filtering and pagination
 * GET /api/admin/disputes
 */
const getAllDisputes = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            priority,
            issue_type,
            vendor,
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
            offset: parseInt(offset)
        });

        // Calculate summary statistics
        const summaryStats = await IssueReport.findAll({
            attributes: [
                'status',
                [IssueReport.sequelize.fn('COUNT', IssueReport.sequelize.col('id')), 'count']
            ],
            group: ['status'],
            raw: true
        });

        const totalDisputes = await IssueReport.count();
        const openDisputes = await IssueReport.count({ where: { status: 'open' } });
        const inProgressDisputes = await IssueReport.count({ where: { status: 'in_progress' } });
        const escalatedDisputes = await IssueReport.count({ where: { priority: 'urgent' } });

        // Fetch disputed_amount, favour_amount, and favoue_status for each dispute using raw SQL
        const disputeIds = disputes.map(d => d.id);
        const disputedAmounts = {};
        const favourAmounts = {};
        const favoueStatuses = {};
        if (disputeIds.length > 0) {
            const disputeDataResults = await IssueReport.sequelize.query(
                'SELECT id, disputed_amount, favour_amount, favoue_status FROM issue_reports WHERE id IN (:ids)',
                {
                    replacements: { ids: disputeIds },
                    type: IssueReport.sequelize.QueryTypes.SELECT
                }
            );
            disputeDataResults.forEach(result => {
                disputedAmounts[result.id] = result.disputed_amount;
                favourAmounts[result.id] = result.favour_amount;
                favoueStatuses[result.id] = result.favoue_status;
            });
        }

        res.json({
            success: true,
            data: {
                disputes: disputes.map(dispute => ({
                    id: dispute.id,
                    dispute_id: `DISP${dispute.id.toString().padStart(3, '0')}`,
                    name: dispute.name,
                    email: dispute.email,
                    phone_number: dispute.phone_number,
                    issue_type: dispute.issue_type,
                    issue_category: dispute.issue_category,
                    description: dispute.description,
                    status: dispute.status,
                    priority: dispute.priority,
                    disputed_amount: disputedAmounts[dispute.id] || null,
                    favour_amount: favourAmounts[dispute.id] || null,
                    favoue_status: favoueStatuses[dispute.id] || null,
                    created_at: dispute.created_at,
                    updated_at: dispute.updated_at,
                    resolved_at: dispute.resolved_at,
                    assigned_to: dispute.assignedUser ? {
                        id: dispute.assignedUser.id,
                        name: dispute.assignedUser.name || dispute.assignedUser.email
                    } : null,
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
                        booking_date: dispute.booking.booking_date,
                        final_amount: dispute.booking.final_amount
                    } : null,
                    customer_info: dispute.customer ? {
                        id: dispute.customer.id,
                        name: dispute.customer.name,
                        email: dispute.customer.email,
                        phone: dispute.customer.phone
                    } : null
                })),
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(count / limit),
                    totalDisputes: count,
                    hasNext: offset + disputes.length < count,
                    hasPrev: page > 1
                },
                summary: {
                    total: totalDisputes,
                    open: openDisputes,
                    inProgress: inProgressDisputes,
                    escalated: escalatedDisputes,
                    resolved: await IssueReport.count({ where: { status: 'resolved' } }),
                    closed: await IssueReport.count({ where: { status: 'closed' } })
                }
            }
        });

    } catch (error) {
        console.error("Error fetching disputes:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch disputes",
            error: process.env.NODE_ENV === "development" ? error.message : "Something went wrong"
        });
    }
};

/**
 * Get dispute by ID
 * GET /api/admin/disputes/:id
 */
const getDisputeById = async (req, res) => {
    try {
        const { id } = req.params;

        const dispute = await IssueReport.findByPk(id, {
            include: [
                {
                    model: Booking,
                    as: "booking",
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
                message: "Dispute not found"
            });
        }

        // Fetch disputed_amount, favour_amount, and favoue_status using raw SQL
        const disputeDataResult = await IssueReport.sequelize.query(
            'SELECT disputed_amount, favour_amount, favoue_status FROM issue_reports WHERE id = :id',
            {
                replacements: { id: dispute.id },
                type: IssueReport.sequelize.QueryTypes.SELECT
            }
        );
        const disputeData = disputeDataResult[0] || {};
        const disputedAmount = disputeData.disputed_amount || null;
        const favourAmount = disputeData.favour_amount || null;
        const favoueStatus = disputeData.favoue_status || null;

        res.json({
            success: true,
            data: {
                id: dispute.id,
                dispute_id: `DISP${dispute.id.toString().padStart(3, '0')}`,
                name: dispute.name,
                email: dispute.email,
                phone_number: dispute.phone_number,
                issue_type: dispute.issue_type,
                issue_category: dispute.issue_category,
                description: dispute.description,
                status: dispute.status,
                priority: dispute.priority,
                disputed_amount: disputedAmount,
                favour_amount: favourAmount,
                favoue_status: favoueStatus,
                resolution_notes: dispute.resolution_notes,
                created_at: dispute.created_at,
                updated_at: dispute.updated_at,
                resolved_at: dispute.resolved_at,
                assigned_to: dispute.assignedUser ? {
                    id: dispute.assignedUser.id,
                    name: dispute.assignedUser.name || dispute.assignedUser.email
                } : null,
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
                    booking_date: dispute.booking.booking_date,
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
        console.error("Error fetching dispute:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch dispute",
            error: process.env.NODE_ENV === "development" ? error.message : "Something went wrong"
        });
    }
};

/**
 * Update dispute status and assign to admin
 * PUT /api/admin/disputes/:id
 */
const updateDispute = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, priority, assigned_to, resolution_notes, disputed_amount } = req.body;
        const adminId = req.user?.id || null; // Handle case when auth is bypassed

        const dispute = await IssueReport.findByPk(id);
        if (!dispute) {
            return res.status(404).json({
                success: false,
                message: "Dispute not found"
            });
        }

        console.log("Dispute found:", dispute.id, dispute.status);

        const updateData = {};
        
        if (status) {
            updateData.status = status;
            if (status === 'resolved' || status === 'closed') {
                updateData.resolved_at = new Date();
            }
        }
        
        if (priority) {
            updateData.priority = priority;
            
            // Auto-resolve when escalated (priority = 'urgent')
            if (priority === 'urgent') {
                updateData.status = 'resolved';
                updateData.resolved_at = new Date();
                updateData.resolution_notes = updateData.resolution_notes || 'Dispute automatically resolved due to escalation';
            }
        }
        
        if (assigned_to !== undefined) {
            updateData.assigned_to = assigned_to || null;
        }
        
        if (resolution_notes) {
            updateData.resolution_notes = resolution_notes;
        }
        
        if (disputed_amount !== undefined) {
            // Get existing disputed_amount from database
            const existingDisputeResult = await IssueReport.sequelize.query(
                'SELECT disputed_amount FROM issue_reports WHERE id = :id',
                {
                    replacements: { id: id },
                    type: IssueReport.sequelize.QueryTypes.SELECT
                }
            );
            const existingDisputedAmount = existingDisputeResult[0]?.disputed_amount;
            const apiAmount = parseFloat(disputed_amount) || 0;
            
            // Convert existing amount to number, handling null case
            // If existing is null, treat it as 0 for comparison purposes
            const existingAmount = existingDisputedAmount !== null && existingDisputedAmount !== undefined 
                ? parseFloat(existingDisputedAmount) 
                : 0;

            // Rule 4: If API amount > existing disputed_amount, don't store and return error
            // Only check if existing amount is not null (i.e., there was an original disputed amount)
            if (existingDisputedAmount !== null && existingDisputedAmount !== undefined && apiAmount > existingAmount) {
                return res.status(400).json({
                    success: false,
                    message: "Amount cannot exceed the original disputed amount",
                    error: "Amount validation failed"
                });
            }

            // Determine favour_status based on rules
            let favourStatus = null;
            
            // Rule 1: If API amount is 0, set favour_status as "vendor Favour"
            if (apiAmount === 0) {
                favourStatus = "vendor Favour";
            }
            // Rule 2: If API amount equals existing disputed_amount, set favour_status as "Customer Favour"
            // Only apply if existing amount is not null
            else if (existingDisputedAmount !== null && existingDisputedAmount !== undefined && apiAmount === existingAmount) {
                favourStatus = "Customer Favour";
            }
            // Rule 3: If API amount < existing disputed_amount, set favour_status as "Adjustment"
            // Only apply if existing amount is not null
            else if (existingDisputedAmount !== null && existingDisputedAmount !== undefined && apiAmount < existingAmount) {
                favourStatus = "Adjustment";
            }

            // Store disputed_amount from API in favour_amount column instead of disputed_amount
            // Update both favour_amount and favoue_status using raw SQL
            await IssueReport.sequelize.query(
                'UPDATE issue_reports SET favour_amount = :amount, favoue_status = :status WHERE id = :id',
                {
                    replacements: { 
                        amount: apiAmount, 
                        status: favourStatus,
                        id: id 
                    },
                    type: IssueReport.sequelize.QueryTypes.UPDATE
                }
            );
        }

        console.log("Update data:", updateData);
        await dispute.update(updateData);
        console.log("After update - dispute.id:", dispute.id);

        // Reload the dispute to get updated data
        await dispute.reload();
        console.log("After reload - dispute.id:", dispute.id);

        // Fetch updated disputed_amount, favour_amount, and favoue_status using raw SQL
        const disputeDataResult = await IssueReport.sequelize.query(
            'SELECT disputed_amount, favour_amount, favoue_status FROM issue_reports WHERE id = :id',
            {
                replacements: { id: dispute.id },
                type: IssueReport.sequelize.QueryTypes.SELECT
            }
        );
        const disputeData = disputeDataResult[0] || {};
        const disputedAmount = disputeData.disputed_amount || null;
        const favourAmount = disputeData.favour_amount || null;
        const favoueStatus = disputeData.favoue_status || null;

        res.json({
            success: true,
            message: "Dispute updated successfully",
            data: {
                id: dispute.id,
                status: dispute.status,
                priority: dispute.priority,
                assigned_to: dispute.assigned_to,
                resolution_notes: dispute.resolution_notes,
                disputed_amount: disputedAmount,
                favour_amount: favourAmount,
                favoue_status: favoueStatus,
                resolved_at: dispute.resolved_at,
                updated_at: dispute.updated_at
            }
        });

    } catch (error) {
        console.error("Error updating dispute:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update dispute",
            error: error.message || "Something went wrong"
        });
    }
};

/**
 * Get dispute statistics for dashboard
 * GET /api/admin/disputes/stats
 */
const getDisputeStats = async (req, res) => {
    try {
        const stats = await IssueReport.findAll({
            attributes: [
                'status',
                'priority',
                [IssueReport.sequelize.fn('COUNT', IssueReport.sequelize.col('id')), 'count']
            ],
            group: ['status', 'priority'],
            raw: true
        });

        const totalDisputes = await IssueReport.count();
        const openDisputes = await IssueReport.count({ where: { status: 'open' } });
        const inProgressDisputes = await IssueReport.count({ where: { status: 'in_progress' } });
        const resolvedDisputes = await IssueReport.count({ where: { status: 'resolved' } });
        const closedDisputes = await IssueReport.count({ where: { status: 'closed' } });
        const escalatedDisputes = await IssueReport.count({ where: { priority: 'urgent' } });

        // Calculate disputed amount from the disputed_amount field using raw SQL
        const disputedAmountResult = await IssueReport.sequelize.query(
            'SELECT SUM(disputed_amount) as total FROM issue_reports WHERE disputed_amount IS NOT NULL',
            {
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
                disputedAmount: disputedAmount,
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
        console.error("Error fetching dispute stats:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch dispute statistics",
            error: process.env.NODE_ENV === "development" ? error.message : "Something went wrong"
        });
    }
};

module.exports = {
    getAllDisputes,
    getDisputeById,
    updateDispute,
    getDisputeStats
};
