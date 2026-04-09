const { IssueReport, Booking, Customer, User } = require("../../models");
const { Op } = require("sequelize");

// Get all issue reports with filters
const getAllIssues = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            priority,
            issue_type,
            booking_id,
            customer_id,
            assigned_to,
            search,
            sort_by = "created_at",
            sort_order = "DESC",
        } = req.query;

        const offset = (page - 1) * limit;
        const whereClause = {};

        if (status) whereClause.status = status;
        if (priority) whereClause.priority = priority;
        if (issue_type) whereClause.issue_type = issue_type;
        if (booking_id) whereClause.booking_id = booking_id;
        if (customer_id) whereClause.customer_id = customer_id;
        if (assigned_to) whereClause.assigned_to = assigned_to;

        if (search) {
            whereClause[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { phone_number: { [Op.like]: `%${search}%` } },
                { ticket_id: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } },
            ];
        }

        const { count, rows: issues } = await IssueReport.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Booking,
                    as: "booking",
                    attributes: ["id", "booking_reference", "status", "total_amount"],
                    required: false,
                },
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name", "email", "phone"],
                    required: false,
                },
                {
                    model: User,
                    as: "assignedUser",
                    attributes: ["id", "name", "email"],
                    required: false,
                },
            ],
            order: [[sort_by, sort_order.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset),
        });

        res.json({
            success: true,
            data: {
                issues,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: Math.ceil(count / limit),
                    total_items: count,
                    items_per_page: parseInt(limit),
                },
            },
        });
    } catch (error) {
        console.error("Error fetching issues:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch issue reports",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

// Get issue statistics
const getIssueStats = async (req, res) => {
    try {
        const totalIssues = await IssueReport.count();

        const byStatus = await IssueReport.findAll({
            attributes: [
                "status",
                [IssueReport.sequelize.fn("COUNT", IssueReport.sequelize.col("id")), "count"],
            ],
            group: ["status"],
        });

        const byPriority = await IssueReport.findAll({
            attributes: [
                "priority",
                [IssueReport.sequelize.fn("COUNT", IssueReport.sequelize.col("id")), "count"],
            ],
            group: ["priority"],
        });

        const byIssueType = await IssueReport.findAll({
            attributes: [
                "issue_type",
                [IssueReport.sequelize.fn("COUNT", IssueReport.sequelize.col("id")), "count"],
            ],
            group: ["issue_type"],
        });

        const unassigned = await IssueReport.count({
            where: { assigned_to: null, status: { [Op.notIn]: ["resolved", "closed"] } },
        });

        res.json({
            success: true,
            data: {
                total_issues: totalIssues,
                unassigned_open: unassigned,
                by_status: byStatus,
                by_priority: byPriority,
                by_issue_type: byIssueType,
            },
        });
    } catch (error) {
        console.error("Error fetching issue stats:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch issue statistics",
        });
    }
};

// Get single issue report
const getIssueById = async (req, res) => {
    try {
        const { id } = req.params;

        const issue = await IssueReport.findByPk(id, {
            include: [
                {
                    model: Booking,
                    as: "booking",
                    attributes: ["id", "booking_reference", "status", "total_amount", "created_at"],
                    required: false,
                },
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name", "email", "phone"],
                    required: false,
                },
                {
                    model: User,
                    as: "assignedUser",
                    attributes: ["id", "name", "email"],
                    required: false,
                },
            ],
        });

        if (!issue) {
            return res.status(404).json({
                success: false,
                message: "Issue report not found",
            });
        }

        res.json({
            success: true,
            data: issue,
        });
    } catch (error) {
        console.error("Error fetching issue:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch issue report",
        });
    }
};

// Update issue report (status, priority, assignment, resolution)
const updateIssue = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            status,
            priority,
            assigned_to,
            resolution_notes,
            sla,
            favoue_status,
            favour_amount,
            disputed_amount,
            Escalate_status,
            Escalate_reason,
            ticket_status,
            last_comment,
            reason,
        } = req.body;

        const issue = await IssueReport.findByPk(id);

        if (!issue) {
            return res.status(404).json({
                success: false,
                message: "Issue report not found",
            });
        }

        if (status !== undefined) issue.status = status;
        if (priority !== undefined) issue.priority = priority;
        if (assigned_to !== undefined) issue.assigned_to = assigned_to;
        if (resolution_notes !== undefined) issue.resolution_notes = resolution_notes;
        if (sla !== undefined) issue.sla = sla;
        if (favoue_status !== undefined) issue.favoue_status = favoue_status;
        if (favour_amount !== undefined) issue.favour_amount = favour_amount;
        if (disputed_amount !== undefined) issue.disputed_amount = disputed_amount;
        if (Escalate_status !== undefined) issue.Escalate_status = Escalate_status;
        if (Escalate_reason !== undefined) issue.Escalate_reason = Escalate_reason;
        if (ticket_status !== undefined) issue.ticket_status = ticket_status;
        if (last_comment !== undefined) issue.last_comment = last_comment;
        if (reason !== undefined) issue.reason = reason;

        // Auto-set resolved_at when status moves to resolved
        if (status === "resolved" && !issue.resolved_at) {
            issue.resolved_at = new Date();
        }

        await issue.save();

        res.json({
            success: true,
            message: "Issue report updated successfully",
            data: issue,
        });
    } catch (error) {
        console.error("Error updating issue:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update issue report",
        });
    }
};

// Delete issue report
const deleteIssue = async (req, res) => {
    try {
        const { id } = req.params;

        const issue = await IssueReport.findByPk(id);

        if (!issue) {
            return res.status(404).json({
                success: false,
                message: "Issue report not found",
            });
        }

        await issue.destroy();

        res.json({
            success: true,
            message: "Issue report deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting issue:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete issue report",
        });
    }
};

module.exports = {
    getAllIssues,
    getIssueStats,
    getIssueById,
    updateIssue,
    deleteIssue,
};
