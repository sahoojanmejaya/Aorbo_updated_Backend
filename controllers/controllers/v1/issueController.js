const { IssueReport, Booking, Customer, Trek, Vendor } = require("../../models");
const { Op } = require("sequelize");
const logger = require("../../utils/logger");

/**
 * Submit an issue report from mobile app
 * POST /api/v1/issues/submit
 */
const submitIssueReport = async (req, res) => {
    try {
        // Identity from JWT — never from req.body
        const authenticatedCustomerId = req.customer.id;

        const {
            booking_id, // TIN/Trip ID
            issue_type,
            issue_category,
            description,
            priority,
            sla
        } = req.body;

        // Validate required fields
        if (!booking_id || !issue_type) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: booking_id and issue_type are required",
                required_fields: ["booking_id", "issue_type"]
            });
        }

        // Validate issue_type enum
        const validIssueTypes = ["accommodation_issue", "trek_services_issue", "transportation_issue", "other"];
        if (!validIssueTypes.includes(issue_type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid issue_type. Must be one of: accommodation_issue, trek_services_issue, transportation_issue, other",
                valid_types: validIssueTypes
            });
        }

        // Validate issue_category if provided
        if (issue_category) {
            const validCategories = ["drunken_driving", "rash_unsafe_driving", "sexual_harassment", "verbal_abuse_assault", "others"];
            if (!validCategories.includes(issue_category)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid issue_category. Must be one of: drunken_driving, rash_unsafe_driving, sexual_harassment, verbal_abuse_assault, others",
                    valid_categories: validCategories
                });
            }
        }

        // Validate priority if provided
        if (priority) {
            const validPriorities = ["low", "medium", "high", "urgent"];
            if (!validPriorities.includes(priority)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid priority. Must be one of: low, medium, high, urgent",
                    valid_priorities: validPriorities
                });
            }
        }

        // Verify booking exists AND belongs to the authenticated customer (ownership check)
        const booking = await Booking.findOne({
            where: { id: booking_id, customer_id: authenticatedCustomerId },
            include: [
                { model: Trek, as: "trek" },
                { model: Vendor, as: "vendor" }
            ]
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        const customer_id = authenticatedCustomerId;

        // Determine priority - use provided priority or set based on issue type
        let finalPriority = priority;
        if (!finalPriority) {
            finalPriority = issue_type === "other" ? "medium" : "high"; // Set higher priority for specific issues
        }

        const bookingTotalAmount = parseFloat(booking.total_amount || 0);

        // Create the issue report — identity sourced from JWT, not body
        const issueReport = await IssueReport.create({
            booking_id: booking_id,
            customer_id: customer_id,
            issue_type: issue_type,
            issue_category: issue_category || null,
            description: description ? description.trim() : null,
            status: "open", // Default status is now "open"
            priority: finalPriority,
            sla: sla || null,
            disputed_amount: bookingTotalAmount, // Store booking's total amount in disputed_amount
            favoue_status: "No Action" // Set default favour_status as "No Action"
        });


        // Return success response with issue report details
        res.status(201).json({
            success: true,
            message: "Issue report submitted successfully",
            data: {
                issue_id: issueReport.id,
                booking_id: issueReport.booking_id,
                issue_type: issueReport.issue_type,
                issue_category: issueReport.issue_category,
                status: issueReport.status,
                priority: issueReport.priority,
                sla: issueReport.sla,
                disputed_amount: issueReport.disputed_amount || bookingTotalAmount,
                favoue_status: issueReport.favoue_status || "No Action",
                created_at: issueReport.created_at,
                booking_info: {
                    trek_name: booking.trek?.name,
                    vendor_name: booking.vendor?.business_name,
                    booking_date: booking.booking_date,
                    booking_amount: bookingTotalAmount
                }
            }
        });

    } catch (error) {
        logger.error("issue", "Error submitting issue report", { error: error.message });
        res.status(500).json({
            success: false,
            message: "Internal server error while submitting issue report",
        });
    }
};

/**
 * Get issue report by ID (for admin/customer to check status)
 * GET /api/v1/issues/:id
 */
const getIssueReport = async (req, res) => {
    try {
        const { id } = req.params;
        const customerId = req.customer.id;

        const issueReport = await IssueReport.findByPk(id, {
            include: [
                {
                    model: Booking,
                    as: "booking",
                    include: [
                        { model: Trek, as: "trek" },
                        { model: Vendor, as: "vendor" }
                    ]
                },
            ]
        });

        if (!issueReport) {
            return res.status(404).json({ success: false, message: "Issue report not found" });
        }

        // Ownership check: customer can only see their own reports
        if (issueReport.customer_id !== customerId) {
            return res.status(403).json({ success: false, message: "Access denied" });
        }

        res.json({
            success: true,
            data: {
                id: issueReport.id,
                booking_id: issueReport.booking_id,
                name: issueReport.name,
                phone_number: issueReport.phone_number,
                email: issueReport.email,
                issue_type: issueReport.issue_type,
                issue_category: issueReport.issue_category,
                description: issueReport.description,
                status: issueReport.status,
                priority: issueReport.priority,
                sla: issueReport.sla,
                resolution_notes: issueReport.resolution_notes,
                created_at: issueReport.created_at,
                updated_at: issueReport.updated_at,
                resolved_at: issueReport.resolved_at,
                booking_info: issueReport.booking ? {
                    trek_name: issueReport.booking.trek?.name,
                    vendor_name: issueReport.booking.vendor?.business_name,
                    booking_date: issueReport.booking.booking_date
                } : null
            }
        });

    } catch (error) {
        logger.error("issue", "Error fetching issue report", { error: error.message });
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Get issue reports by booking ID
 * GET /api/v1/issues/booking/:booking_id
 */
const getIssueReportsByBooking = async (req, res) => {
    try {
        const { booking_id } = req.params;
        const customerId = req.customer.id;

        // Ownership: verify booking belongs to customer
        const booking = await Booking.findOne({ where: { id: booking_id, customer_id: customerId } });
        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        const issueReports = await IssueReport.findAll({
            where: { booking_id: booking_id, customer_id: customerId },
            include: [
                { 
                    model: Booking, 
                    as: "booking",
                    include: [
                        { model: Trek, as: "trek" },
                        { model: Vendor, as: "vendor" }
                    ]
                }
            ],
            order: [['created_at', 'DESC']]
        });

        res.json({
            success: true,
            data: issueReports.map(report => ({
                id: report.id,
                issue_type: report.issue_type,
                issue_category: report.issue_category,
                status: report.status,
                priority: report.priority,
                sla: report.sla,
                created_at: report.created_at,
                description: report.description
            }))
        });

    } catch (error) {
        logger.error("issue", "Error fetching issue reports by booking", { error: error.message });
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = {
    submitIssueReport,
    getIssueReport,
    getIssueReportsByBooking
};
