const {
    Customer,
    Booking,
    Batch,
    Trek,
    BookingTraveler,
    Traveler,
    State,
    EmergencyContact,
    Vendor,
    User,
    TrekStage,
    IssueReport,
    Rating,
    CancellationBooking,
} = require("../../models");
const { Op, fn, col } = require("sequelize");
const { sequelize } = require("../../models");

const parsePaginationParams = (page, limit) => {
    const pageNumber = Math.max(parseInt(page || 1, 10), 1);
    const pageSize = Math.min(
        Math.max(parseInt(limit || 25, 10), 1),
        100
    );

    return {
        page: pageNumber,
        limit: pageSize,
        offset: (pageNumber - 1) * pageSize,
    };
};

const calculateAgeFromDob = (dob) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    if (Number.isNaN(birthDate.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birthDate.getFullYear();
    const monthDiff = now.getMonth() - birthDate.getMonth();
    if (
        monthDiff < 0 ||
        (monthDiff === 0 && now.getDate() < birthDate.getDate())
    ) {
        age -= 1;
    }
    return age >= 0 ? age : null;
};

exports.getCustomersSummary = async (req, res) => {
    try {
        const { search, status, page, limit, hasBookings } = req.query;
        const { page: pageNumber, limit: pageSize, offset } =
            parsePaginationParams(page, limit);

        const whereClause = {};

        const trimmedSearch = (search || "").trim();
        if (trimmedSearch && trimmedSearch !== "undefined") {
            const searchConditions = [
                {
                    name: {
                        [Op.like]: `%${trimmedSearch}%`,
                    },
                },
                {
                    email: {
                        [Op.like]: `%${trimmedSearch}%`,
                    },
                },
                {
                    phone: {
                        [Op.like]: `%${trimmedSearch}%`,
                    },
                },
            ];

            if (!Number.isNaN(Number(trimmedSearch))) {
                searchConditions.push({
                    id: Number(trimmedSearch),
                });
            }

            whereClause[Op.or] = searchConditions;
        }

        if (
            status &&
            status !== "all" &&
            status !== "undefined"
        ) {
            whereClause.status = status.toLowerCase();
        }

        const bookingsFilter = (hasBookings || "all").toLowerCase();
        if (["yes", "no"].includes(bookingsFilter)) {
            const confirmedBookings = await Booking.findAll({
                attributes: ["customer_id"],
                where: {
                    status: "confirmed",
                    customer_id: {
                        [Op.ne]: null,
                    },
                },
                group: ["customer_id"],
                raw: true,
            });

            const customerIdsWithBookings = confirmedBookings.map(
                (entry) => entry.customer_id
            );

            if (bookingsFilter === "yes") {
                if (!customerIdsWithBookings.length) {
                    return res.json({
                        success: true,
                        data: [],
                        pagination: {
                            currentPage: pageNumber,
                            totalPages: 0,
                            totalCount: 0,
                            itemsPerPage: pageSize,
                        },
                        summary: {
                            total: 0,
                            statuses: {
                                active: 0,
                                inactive: 0,
                                suspended: 0,
                                banned: 0,
                                other: 0,
                            },
                        },
                    });
                }

                whereClause.id = {
                    [Op.in]: customerIdsWithBookings,
                };
            } else if (bookingsFilter === "no" && customerIdsWithBookings.length) {
                whereClause.id = {
                    [Op.notIn]: customerIdsWithBookings,
                };
            }
        }

        const customers = await Customer.findAndCountAll({
            where: whereClause,
            attributes: ["id", "name", "email", "phone", "createdAt", "status"],
            order: [["created_at", "DESC"]],
            limit: pageSize,
            offset,
            distinct: true,
        });

        const customerIds = customers.rows.map((customer) => customer.id);

        const bookingCountMap = new Map();
        const lastBookingMap = new Map();

        if (customerIds.length) {
            const bookingCounts = await Booking.findAll({
                where: {
                    customer_id: {
                        [Op.in]: customerIds,
                    },
                    status: "confirmed",
                },
                attributes: [
                    "customer_id",
                    [fn("COUNT", col("id")), "count"],
                ],
                group: ["customer_id"],
                raw: true,
            });

            bookingCounts.forEach((entry) => {
                bookingCountMap.set(
                    entry.customer_id,
                    Number(entry.count) || 0
                );
            });

            const lastBookingTimestamps = await Booking.findAll({
                where: {
                    customer_id: {
                        [Op.in]: customerIds,
                    },
                    status: "confirmed",
                },
                attributes: [
                    "customer_id",
                    [fn("MAX", col("created_at")), "last_created_at"],
                ],
                group: ["customer_id"],
                raw: true,
            });

            const lastBookingConditions = lastBookingTimestamps.map(
                (record) => ({
                    customer_id: record.customer_id,
                    status: "confirmed",
                    created_at: record.last_created_at,
                })
            );

            if (lastBookingConditions.length) {
                const lastBookings = await Booking.findAll({
                    where: {
                        [Op.or]: lastBookingConditions,
                    },
                    include: [
                        {
                            model: Batch,
                            as: "batch",
                            attributes: ["id", "tbr_id"],
                        },
                        {
                            model: Trek,
                            as: "trek",
                            attributes: ["id", "title"],
                        },
                    ],
                    attributes: ["id", "customer_id", "batch_id", "trek_id"],
                    order: [["created_at", "DESC"]],
                });

                lastBookings.forEach((booking) => {
                    lastBookingMap.set(booking.customer_id, {
                        id: booking.id,
                        batch_id: booking.batch_id,
                        tbr_id: booking.batch ? booking.batch.tbr_id : null,
                        trek_id: booking.trek_id,
                        trek_title: booking.trek ? booking.trek.title : null,
                    });
                });
            }
        }

        const statusCountsRaw = await Customer.findAll({
            where: whereClause,
            attributes: ["status", [fn("COUNT", col("id")), "count"]],
            group: ["status"],
            raw: true,
        });

        const statusCounts = statusCountsRaw.reduce((acc, record) => {
            const key = (record.status || "unknown").toLowerCase();
            acc[key] = Number(record.count) || 0;
            return acc;
        }, {});

        const data = customers.rows.map((customer) => ({
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            joining_date: customer.createdAt
                ? customer.createdAt.toISOString()
                : null,
            status: customer.status,
            total_bookings: bookingCountMap.get(customer.id) || 0,
            last_booking: lastBookingMap.get(customer.id) || null,
        }));

        res.json({
            success: true,
            data,
            pagination: {
                currentPage: pageNumber,
                totalPages: Math.ceil(customers.count / pageSize),
                totalCount: customers.count,
                itemsPerPage: pageSize,
            },
            summary: {
                total: customers.count,
                statuses: {
                    active: statusCounts["active"] || 0,
                    inactive: statusCounts["inactive"] || 0,
                    suspended: statusCounts["suspended"] || 0,
                    banned: statusCounts["banned"] || 0,
                    other: Object.entries(statusCounts).reduce(
                        (acc, [key, value]) => {
                            if (
                                !["active", "inactive", "suspended", "banned"].includes(
                                    key
                                )
                            ) {
                                return acc + value;
                            }
                            return acc;
                        },
                        0
                    ),
                },
            },
        });
    } catch (error) {
        console.error("Error fetching admin customers:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch customers",
        });
    }
};

exports.updateCustomerStatusBulk = async (req, res) => {
    try {
        const { ids, status } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Customer IDs are required",
            });
        }

        const normalizedStatus = (status || "").toLowerCase();
        const allowedStatuses = ["active", "suspended", "banned"];

        if (!allowedStatuses.includes(normalizedStatus)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status value",
            });
        }

        const numericIds = ids
            .map((id) => {
                if (typeof id === "number" && Number.isInteger(id)) {
                    return id;
                }
                const match = String(id).match(/\d+/g);
                if (!match) return null;
                const parsed = parseInt(match.join(""), 10);
                return Number.isNaN(parsed) ? null : parsed;
            })
            .filter((id) => id !== null);

        if (!numericIds.length) {
            return res.status(400).json({
                success: false,
                message: "No valid customer IDs provided",
            });
        }

        const [updatedCount] = await Customer.update(
            {
                status: normalizedStatus,
                is_active: normalizedStatus === "active",
            },
            {
                where: {
                    id: {
                        [Op.in]: numericIds,
                    },
                },
            }
        );

        res.json({
            success: true,
            message: `Customer status updated to ${normalizedStatus}`,
            updated: updatedCount,
        });
    } catch (error) {
        console.error("Error updating customer status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update customer status",
        });
    }
};

exports.getCustomerProfileAndTravelers = async (req, res) => {
    try {
        const { id } = req.params;
        const customerId = parseInt(id, 10);

        if (Number.isNaN(customerId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid customer id",
            });
        }

        const customer = await Customer.findByPk(customerId, {
            attributes: [
                "id",
                "name",
                "age",
                "gender",
                "phone",
                "email",
                "last_email",
                "dob",
                "createdAt",
            ],
            include: [
                {
                    model: State,
                    as: "state",
                    attributes: ["id", "name"],
                },
            ],
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found",
            });
        }

        const confirmedBookings = await Booking.findAll({
            where: {
                customer_id: customerId,
                status: "confirmed",
            },
            attributes: ["id"],
            include: [
                {
                    model: Batch,
                    as: "batch",
                    attributes: ["tbr_id"],
                },
                {
                    model: BookingTraveler,
                    as: "travelers",
                    required: false,
                    include: [
                        {
                            model: Traveler,
                            as: "traveler",
                            attributes: ["id", "name", "age", "gender"],
                        },
                    ],
                },
            ],
        });

        const travelerMap = new Map();

        confirmedBookings.forEach((booking) => {
            const tbrId = booking.batch?.tbr_id || null;

            (booking.travelers || []).forEach((bookingTraveler) => {
                const traveler = bookingTraveler.traveler;
                if (!traveler) return;

                const key = traveler.id;
                if (!travelerMap.has(key)) {
                    travelerMap.set(key, {
                        name: traveler.name,
                        age: traveler.age,
                        gender: traveler.gender,
                        linkedTbrIds: new Set(),
                    });
                }

                if (tbrId) {
                    travelerMap.get(key).linkedTbrIds.add(tbrId);
                }
            });
        });

        const subTravelers = Array.from(travelerMap.values()).map(
            (traveler, index) => ({
                sl_no: index + 1,
                name: traveler.name,
                age: traveler.age,
                gender: traveler.gender,
                linked_tbr_ids: Array.from(traveler.linkedTbrIds),
            })
        );

        const emergencyContactsRaw = await EmergencyContact.findAll({
            where: {
                customer_id: customerId,
            },
            order: [["priority", "ASC"]],
        });

        const emergencyContacts = emergencyContactsRaw.map((contact) => ({
            id: contact.id,
            name: contact.name,
            contact_number: contact.phone,
            updated_at:
                contact.updated_at ||
                contact.updatedAt ||
                contact.created_at ||
                contact.createdAt ||
                null,
            status:
                contact.priority === 1
                    ? "Primary"
                    : contact.priority === 2
                    ? "Secondary"
                    : "Backup",
        }));

        res.json({
            success: true,
            data: {
                profile_details: {
                    full_name: customer.name,
                    date_of_birth: customer.dob || null,
                    age:
                        customer.age ??
                        calculateAgeFromDob(customer.dob),
                    gender: customer.gender,
                    phone_number: customer.phone,
                    email: customer.email,
                    last_email: customer.last_email,
                    state: customer.state ? customer.state.name : null,
                    referred_by: null,
                },
                sub_travelers: subTravelers,
                emergency_contacts: emergencyContacts,
            },
        });
    } catch (error) {
        console.error("Error fetching customer profile:", {
            error: error.message,
            stack: error.stack,
        });
        res.status(500).json({
            success: false,
            message: "Failed to fetch customer profile",
        });
    }
};

exports.getCustomerBookingHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const customerId = parseInt(id, 10);

        if (Number.isNaN(customerId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid customer id",
            });
        }

        const customer = await Customer.findByPk(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found",
            });
        }

        const bookings = await Booking.findAll({
            where: {
                customer_id: customerId,
                status: {
                    [Op.in]: ["confirmed", "cancelled"],
                },
            },
            order: [["created_at", "DESC"]],
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "duration", "base_price"],
                },
                {
                    model: Batch,
                    as: "batch",
                    attributes: ["id", "tbr_id"],
                },
                {
                    model: Vendor,
                    as: "vendor",
                    attributes: ["id"],
                    include: [
                        {
                            model: User,
                            as: "user",
                            attributes: ["id", "name"],
                        },
                    ],
                },
            ],
        });

        const bookingIds = bookings.map((booking) => booking.id);
        const batchIds = bookings
            .map((booking) => booking.batch_id)
            .filter(Boolean);
        let trekStagesByBatch = {};

        if (batchIds.length) {
            const stages = await TrekStage.findAll({
                where: {
                    batch_id: {
                        [Op.in]: batchIds,
                    },
                    stage_name: {
                        [Op.in]: ["boarding", "return"],
                    },
                },
            });

            trekStagesByBatch = stages.reduce((acc, stage) => {
                if (!acc[stage.batch_id]) {
                    acc[stage.batch_id] = {};
                }
                const stageKey = (stage.stage_name || "").toLowerCase();
                if (stageKey === "boarding") {
                    acc[stage.batch_id].departure = stage.date_time || null;
                } else if (stageKey === "return") {
                    acc[stage.batch_id].arrival = stage.date_time || null;
                }
                return acc;
            }, {});
        }

        let issueReportByBooking = {};
        if (bookingIds.length) {
            const issueReports = await IssueReport.findAll({
                where: {
                    booking_id: {
                        [Op.in]: bookingIds,
                    },
                },
                order: [["created_at", "DESC"]],
            });

            issueReportByBooking = issueReports.reduce((acc, report) => {
                if (!acc[report.booking_id]) {
                    acc[report.booking_id] = report;
                }
                return acc;
            }, {});
        }

        const bookingDetails = bookings.map((booking) => {
            const bookingData = booking.get({ plain: true });
            const totalAmount = Number(bookingData.total_amount || 0);
            const vendorDiscount = Number(
                bookingData.vendor_discount || 0
            );
            const couponDiscount = Number(
                bookingData.coupon_discount || 0
            );
            const totalPaid =
                totalAmount - vendorDiscount - couponDiscount;

            const stageInfo =
                trekStagesByBatch[bookingData.batch_id] || {};
            const issueReport =
                issueReportByBooking[bookingData.id] || null;

            const basePrice = Number(bookingData.trek?.base_price || 0);
            const slots = Number(bookingData.total_travelers || 0);

            return {
                booking_id: bookingData.id,
                customer_id: bookingData.customer_id,
                trek_id: bookingData.trek_id,
                vendor_id: bookingData.vendor_id,
                batch_id: bookingData.batch_id,
                vendor_details: bookingData.vendor
                    ? {
                          vendor_id: bookingData.vendor.id,
                          vendor_name:
                              bookingData.vendor.user?.name || null,
                      }
                    : null,
                trek_details: {
                    trek_id: bookingData.trek_id,
                    trek_title: bookingData.trek?.title || null,
                    tbr_id: bookingData.batch?.tbr_id || null,
                    status: bookingData.status,
                },
                booking_details: {
                    booking_id: bookingData.id,
                    created_at: bookingData.created_at,
                    booked_slots: bookingData.total_travelers,
                    booking_date: bookingData.booking_date || bookingData.created_at || null,
                    total_amount: totalAmount,
                    vendor_discount: vendorDiscount,
                    coupon_discount: couponDiscount,
                    total_paid: totalPaid,
                    cancelled_by: bookingData.cancelled_by || null,
                },
                trek_stages: {
                    departure: stageInfo.departure || null,
                    arrival: stageInfo.arrival || null,
                    duration: bookingData.trek?.duration || null,
                    base_price: basePrice,
                    base_total: basePrice * slots,
                },
                dispute_details: issueReport
                    ? {
                          created_at: issueReport.created_at,
                          resolved_at: issueReport.resolved_at,
                          status: issueReport.status,
                          favoured_status: issueReport.favoue_status || null,
                          favour_amount: Number(
                              issueReport.favour_amount || 0
                          ),
                      }
                    : {
                          created_at: null,
                          resolved_at: null,
                          status: null,
                          favoured_status: null,
                          favour_amount: 0,
                      },
            };
        });

        const totalBookings = bookingDetails.length;

        // Fetch cancellation data for cancelled bookings of this customer
        const cancelledBookingIds = bookings
            .filter((booking) => booking.status === "cancelled")
            .map((booking) => booking.id);

        let cancellationPerBookings = [];
        if (cancelledBookingIds.length > 0) {
            const cancellations = await CancellationBooking.findAll({
                where: {
                    booking_id: {
                        [Op.in]: cancelledBookingIds,
                    },
                    customer_id: customerId,
                },
                attributes: ["id", "booking_id", "total_refundable_amount", "created_at", "updated_at", "cancellation_date"],
                order: [["created_at", "DESC"]],
            });

            cancellationPerBookings = cancellations.map((cancellation) => {
                const cancellationData = cancellation.get({ plain: true });
                // Get the date (prefer updated_at, fallback to created_at or cancellation_date)
                const cancellationDate = 
                    cancellationData.updated_at || 
                    cancellationData.updatedAt ||
                    cancellationData.cancellation_date ||
                    cancellationData.created_at || 
                    cancellationData.createdAt;
                
                return {
                    booking_id: cancellationData.booking_id,
                    cancellation_id: cancellationData.id,
                    total_refundable_amount: Number(
                        cancellationData.total_refundable_amount || 0
                    ),
                    cancellation_date: cancellationDate,
                };
            });
        }

        res.json({
            success: true,
            data: bookingDetails,
            cancellation_per_bookings: cancellationPerBookings,
            summary: {
                total_bookings: totalBookings,
            },
        });
    } catch (error) {
        console.error("Error fetching customer booking history:", {
            error: error.message,
            stack: error.stack,
        });
        res.status(500).json({
            success: false,
            message: "Failed to fetch customer booking history",
        });
    }
};

exports.getCustomerSupportTickets = async (req, res) => {
    try {
        const { id } = req.params;
        const customerId = parseInt(id, 10);

        if (Number.isNaN(customerId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid customer id",
            });
        }

        const customer = await Customer.findByPk(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found",
            });
        }

        // Get all issue reports for bookings of this customer
        const bookings = await Booking.findAll({
            where: {
                customer_id: customerId,
            },
            attributes: ["id"],
        });

        const bookingIds = bookings.map((booking) => booking.id);

        if (!bookingIds.length) {
            return res.json({
                success: true,
                data: [],
            });
        }

        // Get issue reports with related booking, batch, and assigned user info
        const issueReports = await IssueReport.findAll({
            where: {
                booking_id: {
                    [Op.in]: bookingIds,
                },
            },
            include: [
                {
                    model: Booking,
                    as: "booking",
                    attributes: ["id", "batch_id"],
                    include: [
                        {
                            model: Batch,
                            as: "batch",
                            attributes: ["id", "tbr_id"],
                        },
                    ],
                },
                {
                    model: User,
                    as: "assignedUser",
                    attributes: ["id", "name"],
                    required: false,
                },
            ],
            order: [["created_at", "DESC"]],
        });

        // Helper function to format ticket ID
        const formatTicketId = (id) => {
            return `TKT${String(id).padStart(6, "0")}`;
        };

        // Helper function to format booking ID
        const formatBookingId = (id) => {
            return `BK${String(id).padStart(7, "0")}`;
        };

        // Helper function to get category from issue_type and other fields
        const getCategory = (report) => {
            // If it has disputed amount or favour status, it's likely Payment related
            if (report.disputed_amount && Number(report.disputed_amount) > 0) {
                return "Payment";
            }
            if (report.favoue_status) {
                return "Payment";
            }
            // Otherwise it's Booking related
            return "Booking";
        };

        // Helper function to format issue_category/issue_type for display
        const formatIssueText = (text) => {
            if (!text) return null;
            // Convert snake_case to Title Case
            return text
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        };

        // Helper function to get subject based on status and category
        const getSubject = (report, category) => {
            // Priority 1: If issues_category has value, use it (formatted)
            if (report.issue_category) {
                return formatIssueText(report.issue_category);
            }
            
            // Priority 2: If issues_category is null and category is Payment, use status-based logic
            const status = (report.status || "").toLowerCase();
            const isResolved = status === "resolved";
            const isOpenPending = ["open", "pending", "in_progress"].includes(status);
            
            if (category === "Payment") {
                if (isResolved) {
                    return "Refund status";
                }
                if (isOpenPending) {
                    return "Dispute raised";
                }
            }
            
            // Priority 3: For Booking category, use issue_type if available
            if (category === "Booking") {
                if (report.issue_type) {
                    return formatIssueText(report.issue_type);
                }
                return "Service Request";
            }
            
            // Priority 4: Use description if meaningful
            if (report.description && report.description.trim().length > 3) {
                const desc = report.description.trim();
                if (desc.length <= 50 && /[a-zA-Z]/.test(desc)) {
                    return desc;
                }
            }
            
            return "Support Request";
        };

        // Helper function to calculate SLA hours
        const calculateSLAHours = (createdAt, sla) => {
            if (!createdAt) return { current: 0, target: 0 };
            const now = new Date();
            const created = new Date(createdAt);
            const diffMs = now.getTime() - created.getTime();
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            
            // Parse SLA if it's a string like "72h" or "48h"
            let targetHours = 72; // default
            if (sla) {
                const slaMatch = String(sla).match(/(\d+)/);
                if (slaMatch) {
                    targetHours = parseInt(slaMatch[1], 10);
                }
            }
            
            return {
                current: diffHours,
                target: targetHours,
            };
        };

        // Format the response
        const tickets = issueReports.map((report) => {
            const booking = report.booking;
            const batch = booking?.batch;
            const tbrId = batch?.tbr_id || null;
            const assignedUser = report.assignedUser;

            // Last Update: resolved_at if not null, otherwise updated_at
            const lastUpdate = report.resolved_at || report.updated_at || report.created_at;

            // Format assigned agent
            let assignedAgent = "Unassigned";
            if (assignedUser) {
                assignedAgent = `${assignedUser.name} (AGT${String(assignedUser.id).padStart(2, "0")})`;
            }

            // Calculate SLA
            const slaInfo = calculateSLAHours(report.created_at, report.sla);

            // Get category first
            const category = getCategory(report);

            return {
                ticket_id: report.id,
                ticket_id_formatted: formatTicketId(report.id),
                booking_id: report.booking_id,
                booking_id_formatted: formatBookingId(report.booking_id),
                tbr_id: tbrId,
                category: category,
                subject: getSubject(report, category),
                status: report.status,
                assigned_agent: assignedAgent,
                assigned_agent_id: assignedUser?.id || null,
                assigned_agent_name: assignedUser?.name || null,
                date_created: report.created_at,
                last_update: lastUpdate,
                sla: report.sla,
                sla_current_hours: slaInfo.current,
                sla_target_hours: slaInfo.target,
                issues_type: report.issue_type,
                issues_category: report.issue_category,
                favour_status: report.favoue_status,
                favour_amount: report.favour_amount ? Number(report.favour_amount) : null,
                disputed_amount: report.disputed_amount ? Number(report.disputed_amount) : null,
                name: report.name,
                phone_number: report.phone_number,
                email: report.email,
            };
        });

        res.json({
            success: true,
            data: tickets,
        });
    } catch (error) {
        console.error("Error fetching customer support tickets:", {
            error: error.message,
            stack: error.stack,
        });
        res.status(500).json({
            success: false,
            message: "Failed to fetch customer support tickets",
        });
    }
};

exports.getCustomerReviews = async (req, res) => {
    try {
        const { id } = req.params;
        const customerId = parseInt(id, 10);

        if (Number.isNaN(customerId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid customer id",
            });
        }

        const customer = await Customer.findByPk(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found",
            });
        }

        // Get all ratings for this customer with related booking, batch, and trek info
        const ratings = await Rating.findAll({
            where: {
                customer_id: customerId,
            },
            include: [
                {
                    model: Booking,
                    as: "booking",
                    attributes: ["id", "batch_id"],
                    required: false,
                    include: [
                        {
                            model: Batch,
                            as: "batch",
                            attributes: ["id", "tbr_id"],
                            required: false,
                        },
                    ],
                },
                {
                    model: Batch,
                    as: "batch",
                    attributes: ["id", "tbr_id"],
                    required: false,
                },
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title"],
                    required: false,
                },
            ],
            order: [["created_at", "DESC"]],
        });

        // Format the response
        const reviews = ratings.map((rating) => {
            const booking = rating.booking;
            const batch = rating.batch;
            const bookingBatch = booking?.batch;
            const trek = rating.trek;
            
            // Get tbr_id: first from rating's batch, then from booking's batch
            let tbrId = null;
            if (batch?.tbr_id) {
                tbrId = batch.tbr_id;
            } else if (bookingBatch?.tbr_id) {
                tbrId = bookingBatch.tbr_id;
            }

            // Format review ID
            const reviewId = `R${String(rating.id).padStart(6, "0")}`;
            
            // Format booking ID
            const bookingIdFormatted = rating.booking_id 
                ? `BK${String(rating.booking_id).padStart(7, "0")}`
                : null;

            // Get created_at date - Sequelize maps created_at to createdAt in camelCase
            // Access via toJSON() which returns createdAt
            const ratingJson = rating.toJSON ? rating.toJSON() : (rating.get ? rating.get({ plain: true }) : rating);
            const createdAt = ratingJson.createdAt || rating.createdAt || null;

            return {
                id: rating.id,
                review_id: reviewId,
                booking_id: rating.booking_id,
                booking_id_formatted: bookingIdFormatted,
                tbr_id: tbrId,
                trek_id: rating.trek_id,
                trek_title: trek?.title || null,
                rating_value: rating.rating_value ? Number(rating.rating_value) : null,
                content: rating.content || null,
                date: createdAt,
                is_approved: rating.is_approved !== undefined ? rating.is_approved : true,
                is_hide: rating.is_hide !== undefined ? rating.is_hide : false,
            };
        });

        res.json({
            success: true,
            data: reviews,
        });
    } catch (error) {
        console.error("Error fetching customer reviews:", {
            error: error.message,
            stack: error.stack,
        });
        res.status(500).json({
            success: false,
            message: "Failed to fetch customer reviews",
        });
    }
};

// Admin: Toggle hide/unhide review
exports.toggleReviewHide = async (req, res) => {
    try {
        const { id } = req.params; // customer id
        const { reviewId } = req.params; // rating id

        // Find the rating
        const rating = await Rating.findOne({
            where: {
                id: reviewId,
                customer_id: id,
            },
        });

        if (!rating) {
            return res.status(404).json({
                success: false,
                message: "Review not found",
            });
        }

        // Toggle is_hide
        rating.is_hide = !rating.is_hide;
        await rating.save();

        res.json({
            success: true,
            message: `Review ${rating.is_hide ? "hidden" : "unhidden"} successfully`,
            data: {
                id: rating.id,
                is_hide: rating.is_hide,
            },
        });
    } catch (error) {
        console.error("Error toggling review hide status:", {
            error: error.message,
            stack: error.stack,
        });
        res.status(500).json({
            success: false,
            message: "Failed to toggle review hide status",
        });
    }
};

// Admin: Delete review
exports.deleteReview = async (req, res) => {
    try {
        const { id } = req.params; // customer id
        const { reviewId } = req.params; // rating id

        // Find the rating
        const rating = await Rating.findOne({
            where: {
                id: reviewId,
                customer_id: id,
            },
        });

        if (!rating) {
            return res.status(404).json({
                success: false,
                message: "Review not found",
            });
        }

        // Delete the rating
        await rating.destroy();

        res.json({
            success: true,
            message: "Review deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting review:", {
            error: error.message,
            stack: error.stack,
        });
        res.status(500).json({
            success: false,
            message: "Failed to delete review",
        });
    }
};

// Admin: Get customer analytics/overview
exports.getCustomerAnalytics = async (req, res) => {
    try {
        const { id } = req.params; // customer id
        const customerId = parseInt(id, 10);

        if (!customerId || isNaN(customerId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid customer ID",
            });
        }

        // Check if customer exists
        const customer = await Customer.findByPk(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found",
            });
        }

        // Get last 30 days range (from current date backwards)
        const now = new Date();
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        
        // Calculate 30 days ago from today
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);

        // 1. Total Bookings: Count all bookings for this customer
        const totalBookings = await Booking.count({
            where: {
                customer_id: customerId,
            },
        });

        // 2. Completed Bookings: Count where status is "confirmed" OR "completed"
        const completedBookings = await Booking.count({
            where: {
                customer_id: customerId,
                status: {
                    [Op.in]: ["confirmed", "completed"],
                },
            },
        });

        // 3. Cancelled Bookings: Count where status is "cancelled"
        const cancelledBookings = await Booking.count({
            where: {
                customer_id: customerId,
                status: "cancelled",
            },
        });

        // 4. Total Bookings Amount: Sum of (total_amount - vendor_discount - coupon_discount)
        // Include only confirmed and cancelled status bookings
        const bookings = await Booking.findAll({
            where: {
                customer_id: customerId,
                status: {
                    [Op.in]: ["confirmed", "cancelled"],
                },
            },
            attributes: [
                "id",
                "total_amount",
                "vendor_discount",
                "coupon_discount",
            ],
        });

        let totalBookingsAmount = 0;
        bookings.forEach((booking) => {
            const totalAmount = parseFloat(booking.total_amount) || 0;
            const vendorDiscount = parseFloat(booking.vendor_discount) || 0;
            const couponDiscount = parseFloat(booking.coupon_discount) || 0;
            const bookingAmount = totalAmount - vendorDiscount - couponDiscount;
            totalBookingsAmount += bookingAmount;
        });

        // 5. Date-wise Bookings Amount: Last 30 days from current date
        const last30DaysBookings = await Booking.findAll({
            where: {
                customer_id: customerId,
                booking_date: {
                    [Op.between]: [thirtyDaysAgo, today], // Last 30 days from today
                },
            },
            attributes: [
                "id",
                "booking_date",
                "total_amount",
                "vendor_discount",
                "coupon_discount",
            ],
        });

        // Group by date and calculate total for each date (last 30 days)
        const dateWiseAmounts = {};
        last30DaysBookings.forEach((booking) => {
            const bookingDate = new Date(booking.booking_date);
            const dateKey = `${bookingDate.getFullYear()}-${String(bookingDate.getMonth() + 1).padStart(2, "0")}-${String(bookingDate.getDate()).padStart(2, "0")}`;
            
            const totalAmount = parseFloat(booking.total_amount) || 0;
            const vendorDiscount = parseFloat(booking.vendor_discount) || 0;
            const couponDiscount = parseFloat(booking.coupon_discount) || 0;
            const bookingAmount = totalAmount - vendorDiscount - couponDiscount;

            if (!dateWiseAmounts[dateKey]) {
                dateWiseAmounts[dateKey] = 0;
            }
            dateWiseAmounts[dateKey] += bookingAmount;
        });

        // Generate array for last 30 days (including all dates, even with 0 amount)
        const dailySpend = [];
        const iterateDate = new Date(thirtyDaysAgo);
        
        while (iterateDate <= today) {
            const dateKey = `${iterateDate.getFullYear()}-${String(iterateDate.getMonth() + 1).padStart(2, "0")}-${String(iterateDate.getDate()).padStart(2, "0")}`;
            const amount = dateWiseAmounts[dateKey] || 0;
            
            dailySpend.push({
                date: dateKey,
                day: iterateDate.getDate(),
                month: iterateDate.getMonth() + 1,
                year: iterateDate.getFullYear(),
                amount: parseFloat(amount.toFixed(2)),
            });
            
            // Move to next day
            iterateDate.setDate(iterateDate.getDate() + 1);
        }

        // 6. Disputes Active: Count where status is "open" (not resolved)
        const disputesActive = await IssueReport.count({
            where: {
                customer_id: customerId,
                status: "open",
            },
        });

        // 7. Disputes Customer Favour Count: Count where favoue_status is "Customer Favour"
        const disputesCustomerFavourCount = await IssueReport.count({
            where: {
                customer_id: customerId,
                favoue_status: "Customer Favour",
            },
        });

        // 8. Disputes Refund Count: Sum of all favour_amount
        const disputes = await IssueReport.findAll({
            where: {
                customer_id: customerId,
            },
            attributes: ["favour_amount"],
        });

        let disputesRefundCount = 0;
        disputes.forEach((dispute) => {
            const favourAmount = parseFloat(dispute.favour_amount) || 0;
            disputesRefundCount += favourAmount;
        });

        // 9. Cancelled Bookings Total Refund Amount: Sum of all total_refundable_amount from cancellation_bookings
        const cancellationBookings = await CancellationBooking.findAll({
            where: {
                customer_id: customerId,
            },
            attributes: ["total_refundable_amount"],
        });

        let cancelledBookingsTotalRefundAmount = 0;
        cancellationBookings.forEach((cancellation) => {
            const refundAmount = parseFloat(cancellation.total_refundable_amount) || 0;
            cancelledBookingsTotalRefundAmount += refundAmount;
        });

        // 10. Monthly Bookings: Last 12 months from current month
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth(); // 0-11 (0 = Jan, 11 = Dec)
        
        // Get all bookings for monthly grouping
        const allBookings = await Booking.findAll({
            where: {
                customer_id: customerId,
            },
            attributes: ["id", "booking_date"],
        });

        // Month names for display
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        // Initialize monthly map with last 12 months (including current month)
        const monthlyBookingsMap = {};
        for (let i = 11; i >= 0; i--) {
            const targetDate = new Date(currentYear, currentMonth - i, 1);
            const targetYear = targetDate.getFullYear();
            const targetMonth = targetDate.getMonth();
            const monthKey = `${monthNames[targetMonth]}-${targetYear}`;
            monthlyBookingsMap[monthKey] = {
                month: monthNames[targetMonth],
                year: targetYear,
                monthIndex: targetMonth,
                count: 0,
            };
        }

        // Group bookings by month
        allBookings.forEach((booking) => {
            const bookingDate = new Date(booking.booking_date);
            const bookingYear = bookingDate.getFullYear();
            const bookingMonth = bookingDate.getMonth();
            const monthKey = `${monthNames[bookingMonth]}-${bookingYear}`;
            
            // Only include if within last 12 months range
            if (monthlyBookingsMap[monthKey]) {
                monthlyBookingsMap[monthKey].count += 1;
            }
        });

        // Convert to array and sort by year and month
        const monthlyBookings = Object.values(monthlyBookingsMap).sort((a, b) => {
            if (a.year !== b.year) {
                return a.year - b.year;
            }
            return a.monthIndex - b.monthIndex;
        }).map(item => ({
            month: item.month,
            count: item.count,
        }));

        // Prepare response
        const analytics = {
            total_bookings: totalBookings,
            completed_bookings: completedBookings,
            cancelled_bookings: cancelledBookings,
            total_bookings_amount: parseFloat(totalBookingsAmount.toFixed(2)),
            cancelled_bookings_total_refund_amount: parseFloat(cancelledBookingsTotalRefundAmount.toFixed(2)),
            daily_spend: dailySpend,
            monthly_bookings: monthlyBookings,
            disputes_active: disputesActive,
            disputes_customer_favour_count: disputesCustomerFavourCount,
            disputes_refund_count: parseFloat(disputesRefundCount.toFixed(2)),
        };

        res.json({
            success: true,
            data: analytics,
        });
    } catch (error) {
        console.error("Error fetching customer analytics:", {
            error: error.message,
            stack: error.stack,
        });
        res.status(500).json({
            success: false,
            message: "Failed to fetch customer analytics",
        });
    }
};

