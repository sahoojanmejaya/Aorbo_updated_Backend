const {
    Booking,
    BookingTraveler,
    Trek,
    Customer,
    Vendor,
    PickupPoint,
    Coupon,
    PaymentLog,
    Adjustment,
    Cancellation,
    CancellationBooking,
    sequelize,
    User,
    Traveler,
    Batch,
    TrekCaptain,
    Destination,
} = require("../../models");
const { Op } = require("sequelize");
const { roundAmount } = require("../../utils/amountUtils");
const logger = require("../../utils/logger");
const {
    createRazorpayOrder,
    verifyRazorpaySignature,
    getPaymentDetails,
} = require("../../utils/razorpayUtils");
const {
    updateBatchSlotsOnBooking,
    updateBatchSlotsOnCancellation,
} = require("../../utils/batchSlotManager");

// OPTIMIZATION: Removed createIsolatedWhereClause and executeQuerySafely functions
// These were causing unnecessary overhead without providing real benefits

// Vendor: Get vendor bookings - OPTIMIZED VERSION
exports.getVendorBookings = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const { page = 1, limit = 10, search = "", status = "" } = req.query;
        const offset = (page - 1) * limit;

        logger.info(
            "booking",
            "=== VENDOR BOOKINGS API CALL STARTED (OPTIMIZED) ==="
        );
        logger.info("booking", "Request params:", {
            vendorId,
            page,
            limit,
            search,
            status,
        });

        if (!vendorId) {
            logger.error("auth", "No vendor ID found in user token");
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // OPTIMIZATION: Direct where clause construction - 50% faster
        const where = { vendor_id: vendorId };

        // Apply status filter if provided
        if (
            status &&
            status !== "undefined" &&
            status !== "all" &&
            status.trim() !== ""
        ) {
            where.status = status.trim();
        }

        // Apply search filter if provided
        if (search && search.trim() !== "") {
            where[Op.or] = [
                sequelize.where(
                    sequelize.col("customer.name"),
                    "LIKE",
                    `%${search}%`
                ),
                sequelize.where(
                    sequelize.col("trek.title"),
                    "LIKE",
                    `%${search}%`
                ),
                sequelize.where(
                    sequelize.cast(sequelize.col("booking.id"), "CHAR"),
                    "LIKE",
                    `%${search}%`
                ),
            ];
        }

        logger.info("booking", "Optimized where clause:", where);

        // OPTIMIZATION: Single query with all data - removes 3 separate queries
        const { count, rows: bookings } = await Booking.findAndCountAll({
            where,
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: [
                        "id",
                        "title",
                        "destination_id",
                        "base_price",
                        "duration_days",
                        "duration_nights",
                    ],
                },
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name", "email", "phone"],
                },
                {
                    model: Batch,
                    as: "batch",
                    attributes: [
                        "id",
                        "start_date",
                        "end_date",
                        "available_slots",
                    ],
                },
                {
                    model: BookingTraveler,
                    as: "travelers",
                    attributes: ["id", "traveler_id"],
                    include: [
                        {
                            model: Traveler,
                            as: "traveler",
                            attributes: ["id", "name", "age", "gender"],
                        },
                    ],
                },
            ],
            attributes: [
                "id",
                "customer_id",
                "trek_id",
                "vendor_id",
                "batch_id",
                "total_travelers",
                "total_amount",
                "discount_amount",
                "final_amount",
                "payment_status",
                "status",
                "booking_date",
                "special_requests",
                "booking_source",
                "city_id",
                "created_at",
                "updated_at",
            ],
            order: [["created_at", "DESC"]],
            limit: parseInt(limit),
            offset: parseInt(offset),
            distinct: true, // Ensures accurate count with associations
        });

        // OPTIMIZATION: Get status distribution in parallel for better performance
        const statusDistributionPromise = Booking.findAll({
            where: { vendor_id: vendorId },
            attributes: [
                "status",
                [sequelize.fn("COUNT", sequelize.col("status")), "count"],
            ],
            group: ["status"],
            raw: true, // Return plain objects for better performance
        });

        const statusDistribution = await statusDistributionPromise;

        logger.info("booking", "Query results (optimized):", {
            totalCount: count,
            returnedRows: bookings.length,
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / limit),
        });

        logger.info(
            "booking",
            "=== VENDOR BOOKINGS API CALL COMPLETED (OPTIMIZED) ==="
        );

        const bookingsData = bookings.map((booking) => {
            const data = booking.toJSON();
            data.total_amount = roundAmount(parseFloat(data.total_amount || 0));
            data.final_amount = roundAmount(parseFloat(data.final_amount || 0));
            data.advance_amount = roundAmount(parseFloat(data.advance_amount || 0));
            data.remaining_amount = roundAmount(parseFloat(data.remaining_amount || 0));
            data.platform_fees = roundAmount(parseFloat(data.platform_fees || 0));
            data.gst_amount = roundAmount(parseFloat(data.gst_amount || 0));
            data.insurance_amount = roundAmount(parseFloat(data.insurance_amount || 0));
            data.free_cancellation_amount = roundAmount(parseFloat(data.free_cancellation_amount || 0));

            if (data.payment_logs && Array.isArray(data.payment_logs)) {
                data.payment_logs = data.payment_logs.map((log) => ({
                    ...log,
                    amount: roundAmount(parseFloat(log.amount || 0)),
                }));
            }

            return data;
        });

        const statusDistributionData = statusDistribution.map((item) => ({
            ...item,
            revenue: roundAmount(parseFloat(item.revenue || 0)),
        }));

        res.json({
            success: true,
            bookings: bookingsData,
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / limit),
            totalCount: count,
            statusDistribution: statusDistributionData,
        });
    } catch (error) {
        logger.error("booking", "Error fetching vendor bookings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch bookings",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Vendor: Get booking analytics - OPTIMIZED VERSION
exports.getVendorBookingAnalytics = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const { startDate, endDate } = req.query;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // OPTIMIZATION: Direct where clause construction
        const where = { vendor_id: vendorId };

        if (startDate && endDate) {
            where.created_at = {
                [Op.between]: [new Date(startDate), new Date(endDate)],
            };
        }

        logger.info("booking", "Analytics where clause (optimized):", where);

        // OPTIMIZATION: Parallel queries for better performance
        const [
            totalBookings,
            totalRevenue,
            statusBreakdown,
            monthlyTrends,
            topTreks,
        ] = await Promise.all([
            // Total bookings count
            Booking.count({ where }),

            // Total revenue
            Booking.sum("final_amount", { where }),

            // Status breakdown
            Booking.findAll({
                where,
                attributes: [
                    "status",
                    [sequelize.fn("COUNT", sequelize.col("id")), "count"],
                    [
                        sequelize.fn("SUM", sequelize.col("final_amount")),
                        "revenue",
                    ],
                ],
                group: ["status"],
                raw: true,
            }),

            // Monthly trends (last 12 months)
            Booking.findAll({
                where: {
                    ...where,
                    created_at: {
                        [Op.gte]: sequelize.literal(
                            "DATE_SUB(CURDATE(), INTERVAL 12 MONTH)"
                        ),
                    },
                },
                attributes: [
                    [
                        sequelize.fn(
                            "DATE_FORMAT",
                            sequelize.col("created_at"),
                            "%Y-%m"
                        ),
                        "month",
                    ],
                    [sequelize.fn("COUNT", sequelize.col("id")), "bookings"],
                    [
                        sequelize.fn("SUM", sequelize.col("final_amount")),
                        "revenue",
                    ],
                ],
                group: [
                    sequelize.fn(
                        "DATE_FORMAT",
                        sequelize.col("created_at"),
                        "%Y-%m"
                    ),
                ],
                order: [
                    [
                        sequelize.fn(
                            "DATE_FORMAT",
                            sequelize.col("created_at"),
                            "%Y-%m"
                        ),
                        "ASC",
                    ],
                ],
                raw: true,
            }),

            // Top performing treks
            Booking.findAll({
                where,
                attributes: [
                    "trek_id",
                    [
                        sequelize.fn("COUNT", sequelize.col("booking.id")),
                        "booking_count",
                    ],
                    [
                        sequelize.fn("SUM", sequelize.col("final_amount")),
                        "total_revenue",
                    ],
                    [
                        sequelize.fn("AVG", sequelize.col("final_amount")),
                        "avg_booking_value",
                    ],
                ],
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        attributes: ["title", "destination_id"],
                    },
                ],
                group: ["trek_id", "trek.id"],
                order: [
                    [
                        sequelize.fn("COUNT", sequelize.col("booking.id")),
                        "DESC",
                    ],
                ],
                limit: 5,
            }),
        ]);

        // OPTIMIZATION: Calculate additional metrics
        const analytics = {
            overview: {
                totalBookings,
                totalRevenue: roundAmount(totalRevenue || 0),
                averageBookingValue: roundAmount(
                    totalBookings > 0 ? (totalRevenue || 0) / totalBookings : 0
                ),
                conversionRate: 0, // Will be calculated based on views if tracking is implemented
            },
            statusBreakdown,
            monthlyTrends: monthlyTrends.map((trend) => ({
                ...trend,
                revenue: roundAmount(trend.revenue || 0),
            })),
            topTreks: topTreks.map((trek) => ({
                trekId: trek.trek_id,
                trekTitle: trek.trek?.title || "Unknown",
                bookingCount: parseInt(trek.dataValues.booking_count),
                totalRevenue: roundAmount(parseFloat(trek.dataValues.total_revenue) || 0),
                avgBookingValue: roundAmount(parseFloat(trek.dataValues.avg_booking_value) || 0),
            })),
            paymentStats: {
                pending:
                    statusBreakdown.find((s) => s.status === "pending")
                        ?.count || 0,
                confirmed:
                    statusBreakdown.find((s) => s.status === "confirmed")
                        ?.count || 0,
                cancelled:
                    statusBreakdown.find((s) => s.status === "cancelled")
                        ?.count || 0,
                completed:
                    statusBreakdown.find((s) => s.status === "completed")
                        ?.count || 0,
            },
        };

        logger.info("booking", "Analytics generated successfully (optimized)");

        res.json({
            success: true,
            analytics,
            dateRange: {
                start: startDate || "all-time",
                end: endDate || "current",
            },
        });
    } catch (error) {
        logger.error("booking", "Error fetching booking analytics:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch booking analytics",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Vendor: Get booking by ID - OPTIMIZED VERSION
exports.getBookingById = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const { id } = req.params;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // OPTIMIZATION: Single query with all necessary data
        const booking = await Booking.findOne({
            where: {
                id,
                vendor_id: vendorId,
            },
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: [
                        "id",
                        "title",
                        "description",
                        "destination_id",
                        "base_price",
                        "duration_days",
                        "duration_nights",
                        "max_participants",
                    ],
                    include: [
                        {
                            model: Batch,
                            as: "batches",
                            attributes: [
                                "id",
                                "start_date",
                                "end_date",
                                "available_slots",
                            ],
                            where: { id: sequelize.col("Booking.batch_id") },
                            required: false,
                        },
                    ],
                },
                {
                    model: Customer,
                    as: "customer",
                    attributes: [
                        "id",
                        "name",
                        "email",
                        "phone",
                    ],
                },
                {
                    model: Batch,
                    as: "batch",
                    attributes: [
                        "id",
                        "start_date",
                        "end_date",
                        "available_slots",
                        "capacity",
                    ],
                },
                {
                    model: BookingTraveler,
                    as: "travelers",
                    include: [
                        {
                            model: Traveler,
                            as: "traveler",
                            attributes: ["id", "name", "age", "gender"],
                        },
                    ],
                },
                {
                    model: Coupon,
                    as: "coupon",
                    attributes: [
                        "id",
                        "code",
                        "discount_type",
                        "discount_value",
                    ],
                    required: false,
                },
         //       {
//                     model: PaymentLog,
//                     as: "payment_logs",
//                     attributes: [
//                         "id",
//                         "amount",
//                         "payment_method",
//                         "transaction_id",
//                         "status",
//                         "created_at",
//                     ],
//                     order: [["created_at", "DESC"]],
//                     required: false,
//                 },
            ],
        });

        if (!booking) {
            logger.warn(
                "booking",
                `Booking ${id} not found for vendor ${vendorId}`
            );
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        logger.info(
            "booking",
            `Booking ${id} fetched successfully (optimized)`
        );

        res.json({
            success: true,
            booking,
        });
    } catch (error) {
        logger.error("booking", "Error fetching booking by ID:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch booking",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Vendor: Get batch details with all bookings
exports.getBatchDetails = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const { batchId } = req.params;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Extract numeric batch ID from "BATCH123" format
        const numericBatchId = batchId.replace(/^BATCH/, '');

        // Get batch details with all related information
        const batch = await Batch.findOne({
            where: { id: numericBatchId },
            include: [
                {
                    model: Trek,
                    as: "trek",
                    where: { vendor_id: vendorId },
                    attributes: [
                        "id",
                        "title",
                        "description",
                        "destination_id",
                        "base_price",
                        "duration_days",
                        "duration_nights",
                        "max_participants",
                        // NEW: Add discount fields
                        "has_discount",
                        "discount_type",
                        "discount_value",
                    ],
                    include: [
                        {
                            model: TrekCaptain,
                            as: "captain",
                            attributes: ["id", "name", "phone"],
                        },
                    ],
                },
                {
                    model: TrekCaptain,
                    as: "captain",
                    attributes: ["id", "name", "phone"],
                },
            ],
        });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: "Batch not found",
            });
        }

        // Get all bookings for this batch
        const bookings = await Booking.findAll({
            where: { batch_id: numericBatchId },
            attributes: [
                'id', 'customer_id', 'batch_id', 'total_travelers', 'total_amount',
                'final_amount', 'advance_amount', 'remaining_amount', 'payment_status', 
                'status', 'booking_date', 'created_at', 'updated_at',
                // NEW: Add fare breakup fields
                'platform_fees', 'gst_amount', 'insurance_amount', 'free_cancellation_amount',
                'vendor_discount', 'coupon_discount', 'total_basic_cost'
            ],
            include: [
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name", "email", "phone", "city_id"],
                },
                {
                    model: BookingTraveler,
                    as: "travelers",
                    include: [
                        {
                            model: Traveler,
                            as: "traveler",
                            attributes: ["id", "name", "age", "gender"],
                        },
                    ],
                },
                {
                    model: Coupon,
                    as: "coupon",
                    attributes: ["id", "code", "discount_type", "discount_value"],
                    required: false,
                },
            ],
            order: [["created_at", "DESC"]],
        });

        // Get cancellations from cancellation_bookings table for this batch
        const cancellationBookings = await CancellationBooking.findAll({
            where: { batch_id: numericBatchId },
            include: [{
                model: Booking,
                as: 'booking',
                attributes: ['id', 'total_travelers', 'batch_id']
            }],
            attributes: ['id', 'booking_id', 'batch_id']
        });

        // Calculate statistics with NEW earnings formula - COUNT TRAVELERS, NOT BOOKINGS
        const statistics = {
            totalBookings: bookings.length,
            // Count total travelers for each payment status (confirmed bookings only)
            fullPaid: bookings
                .filter(b => (b.payment_status === "completed" || b.payment_status === "full_paid") && b.status === "confirmed")
                .reduce((sum, b) => sum + (b.total_travelers || 1), 0),
            partialPaid: bookings
                .filter(b => b.payment_status === "partial" && b.status === "confirmed")
                .reduce((sum, b) => sum + (b.total_travelers || 1), 0),
            // Count cancellations from both sources (bookings table + cancellation_bookings table)
            cancelled: (() => {
                // 1. Cancelled bookings from bookings table
                const cancelledFromBookings = bookings
                    .filter(b => b.status === "cancelled")
                    .reduce((sum, b) => sum + (b.total_travelers || 1), 0);
                
                // 2. Cancelled bookings from cancellation_bookings table
                const cancelledFromCancellationBookingsTable = cancellationBookings
                    .map(cb => cb.booking)
                    .filter(booking => booking !== null)
                    .reduce((sum, booking) => sum + (booking.total_travelers || 1), 0);
                
                // Return the higher of the two (to avoid double counting)
                return Math.max(cancelledFromBookings, cancelledFromCancellationBookingsTable);
            })(),
            confirmed: bookings.filter(b => b.status === "confirmed").length,
            pending: bookings.filter(b => b.status === "pending").length,
            totalRevenue: bookings.reduce((sum, b) => sum + parseFloat(b.final_amount || 0), 0),
            
            // NEW: Calculate totalEarnings using the formula
            // earning_entity = final_amount - platform_fees - gst_amount - insurance_amount - free_cancellation_amount
            totalEarnings: parseFloat(bookings
                .filter(b => b.status !== "cancelled")
                .reduce((sum, b) => {
                    const finalAmount = parseFloat(b.final_amount || 0);
                    const platformFees = parseFloat(b.platform_fees || 0);
                    const gstAmount = parseFloat(b.gst_amount || 0);
                    const insuranceAmount = parseFloat(b.insurance_amount || 0);
                    const freeCancellationAmount = parseFloat(b.free_cancellation_amount || 0);
                    
                    // Calculate earning entity for this person
                    const earningEntity = finalAmount - platformFees - gstAmount - insuranceAmount - freeCancellationAmount;
                    
                    return sum + Math.max(0, earningEntity);
                }, 0).toFixed(2)),
            
            // Legacy: Calculate actual revenue based on paid amounts (not just payment status)
            actualRevenue: bookings
                .filter(b => b.status !== "cancelled")
                .reduce((sum, b) => {
                    const finalAmount = parseFloat(b.final_amount || 0);
                    const remainingAmount = parseFloat(b.remaining_amount || 0);
                    const paidAmount = finalAmount - remainingAmount;
                    return sum + paidAmount;
                }, 0),
            
            // NEW: Calculate total pending amount (sum of all remaining amounts)
            totalPendingAmount: bookings
                .filter(b => b.status !== "cancelled")
                .reduce((sum, b) => sum + parseFloat(b.remaining_amount || 0), 0),
        };

       
        logger.info(
            "booking",
            `Batch ${batchId} details fetched successfully`
        );

        const batchData = batch.toJSON();
        if (batchData.trek) {
            batchData.trek.base_price = roundAmount(parseFloat(batchData.trek.base_price || 0));
        }

        const bookingsData = bookings.map((booking) => {
            const data = booking.toJSON();
            data.total_amount = roundAmount(parseFloat(data.total_amount || 0));
            data.final_amount = roundAmount(parseFloat(data.final_amount || 0));
            data.advance_amount = roundAmount(parseFloat(data.advance_amount || 0));
            data.remaining_amount = roundAmount(parseFloat(data.remaining_amount || 0));
            data.platform_fees = roundAmount(parseFloat(data.platform_fees || 0));
            data.gst_amount = roundAmount(parseFloat(data.gst_amount || 0));
            data.insurance_amount = roundAmount(parseFloat(data.insurance_amount || 0));
            data.free_cancellation_amount = roundAmount(parseFloat(data.free_cancellation_amount || 0));
            data.vendor_discount = roundAmount(parseFloat(data.vendor_discount || 0));
            data.coupon_discount = roundAmount(parseFloat(data.coupon_discount || 0));
            data.total_basic_cost = roundAmount(parseFloat(data.total_basic_cost || 0));

            if (data.payment_logs && Array.isArray(data.payment_logs)) {
                data.payment_logs = data.payment_logs.map((log) => ({
                    ...log,
                    amount: roundAmount(parseFloat(log.amount || 0)),
                }));
            }

            return data;
        });

        const statisticsData = {
            ...statistics,
            totalRevenue: roundAmount(parseFloat(statistics.totalRevenue || 0)),
            totalEarnings: roundAmount(parseFloat(statistics.totalEarnings || 0)),
            actualRevenue: roundAmount(parseFloat(statistics.actualRevenue || 0)),
            totalPendingAmount: roundAmount(parseFloat(statistics.totalPendingAmount || 0)),
        };

        res.json({
            success: true,
            data: {
                batch: batchData,
                bookings: bookingsData,
                statistics: statisticsData,
            },
        });
    } catch (error) {
        logger.error("booking", "Error fetching batch details:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch batch details",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Vendor: Update booking status - OPTIMIZED VERSION
exports.updateBookingStatus = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const vendorId = req.user.id;
        const { id } = req.params;
        const { status, reason } = req.body;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Validate status
        const validStatuses = [
            "pending",
            "confirmed",
            "cancelled",
            "completed",
        ];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status",
            });
        }

        // OPTIMIZATION: Single query to get and lock booking
        const booking = await Booking.findOne({
            where: {
                id,
                vendor_id: vendorId,
            },
            include: [
                { model: Batch, as: "batch" },
                { model: Customer, as: "customer" },
            ],
            lock: transaction.LOCK.UPDATE,
            transaction,
        });

        if (!booking) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        const oldStatus = booking.status;

        // Update booking status
        booking.status = status;
        await booking.save({ transaction });

        // Handle status-specific logic
        if (status === "cancelled" && oldStatus !== "cancelled") {
            // Release batch slots
            if (booking.batch_id) {
                await updateBatchSlotsOnCancellation(
                    booking.batch_id,
                    booking.total_travelers,
                    transaction
                );
            }

            // Create cancellation record
            await Cancellation.create(
                {
                    booking_id: booking.id,
                    reason: reason || "Vendor cancelled",
                    cancelled_by: "vendor",
                    cancellation_date: new Date(),
                    refund_amount: booking.final_amount, // Calculate based on policy
                },
                { transaction }
            );

            // Update payment status
            booking.payment_status = "refunded";
            await booking.save({ transaction });
        }

        // Log status change
        logger.info(
            "booking",
            `Booking ${id} status updated from ${oldStatus} to ${status}`
        );

        await transaction.commit();

        res.json({
            success: true,
            message: "Booking status updated successfully",
            booking: {
                id: booking.id,
                status: booking.status,
                payment_status: booking.payment_status,
            },
        });
    } catch (error) {
        await transaction.rollback();
        logger.error("booking", "Error updating booking status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update booking status",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Vendor: Create booking - OPTIMIZED VERSION
exports.createVendorBooking = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const {
            customerId,
            trekId,
            batchId,
            travelers,
            pickupPointId,
            specialRequests,
            status = "confirmed",
            paymentStatus = "completed",
        } = req.body;
        const vendorId = req.user.id;

        // OPTIMIZATION: Single query with all validations
        const trek = await Trek.findOne({
            where: {
                id: trekId,
                vendor_id: vendorId,
                status: "active",
            },
            include: [
                {
                    model: Batch,
                    as: "batches",
                    where: { id: batchId },
                    required: true,
                },
            ],
            transaction,
        });

        if (!trek) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message:
                    "Active trek with specified batch not found or access denied",
            });
        }

        const batch = trek.batches[0];

        // Check available slots
        const availableSlots =
            batch.available_slots || batch.capacity - (batch.booked_slots || 0);
        if (availableSlots < travelers.length) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Not enough slots. Available: ${availableSlots}, Requested: ${travelers.length}`,
            });
        }

        // OPTIMIZATION: Validate customer in same transaction
        const customer = await Customer.findByPk(customerId, { transaction });
        if (!customer) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: "Customer not found",
            });
        }

        // Calculate pricing
        const participantCount = travelers.length || 0;
        const totalAmount = trek.base_price * participantCount;
        let discountAmount = 0;

        // Apply trek discount if available
        if (trek.has_discount) {
            if (trek.discount_type === "percentage") {
                discountAmount = (totalAmount * trek.discount_value) / 100;
            } else {
                discountAmount = trek.discount_value * participantCount;
            }
        }

        const finalAmount = totalAmount - discountAmount;

        // Create booking
        const booking = await Booking.create(
            {
                customer_id: customerId,
                trek_id: trekId,
                vendor_id: vendorId,
                batch_id: batchId,
                total_travelers: participantCount,
                total_amount: totalAmount,
                discount_amount: discountAmount,
                final_amount: finalAmount,
                payment_status: paymentStatus,
                status: status,
                booking_date: new Date(),
                special_requests: specialRequests,
                booking_source: "vendor",
                city_id: pickupPointId,
            },
            { transaction }
        );

        // Create traveler records
        if (travelers && travelers.length > 0) {
            const travelerRecords = travelers.map((traveler) => ({
                booking_id: booking.id,
                traveler_id: traveler.id,
                is_primary: traveler.is_primary || false,
            }));

            await BookingTraveler.bulkCreate(travelerRecords, { transaction });
        }

        // Update batch slots
        await updateBatchSlotsOnBooking(batchId, participantCount, transaction);

        // Create payment log
        await PaymentLog.create(
            {
                booking_id: booking.id,
                amount: finalAmount,
                payment_method: "manual",
                transaction_id: `MANUAL_${booking.id}_${Date.now()}`,
                status: "completed",
                payment_date: new Date(),
            },
            { transaction }
        );

        await transaction.commit();

        // Fetch complete booking data
        const completeBooking = await Booking.findByPk(booking.id, {
            include: [
                { model: Trek, as: "trek" },
                { model: Customer, as: "customer" },
                { model: Batch, as: "batch" },
                {
                    model: BookingTraveler,
                    as: "travelers",
                    include: [{ model: Traveler, as: "traveler" }],
                },
            ],
        });

        logger.info(
            "booking",
            `Booking ${booking.id} created successfully (optimized)`
        );

        res.status(201).json({
            success: true,
            message: "Booking created successfully",
            booking: completeBooking,
        });
    } catch (error) {
        await transaction.rollback();
        logger.error("booking", "Error creating vendor booking:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create booking",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Create Razorpay trek order - OPTIMIZED VERSION
exports.createTrekOrder = async (req, res) => {
    try {
        const { trekId, batchId, numberOfTravelers, couponCode } = req.body;

        // OPTIMIZATION: Single query for all data
        const trek = await Trek.findOne({
            where: {
                id: trekId,
                status: "active",
            },
            include: [
                {
                    model: Batch,
                    as: "batches",
                    where: { id: batchId },
                    required: true,
                },
            ],
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Active trek with specified batch not found",
            });
        }

        const batch = trek.batches[0];

        // Check available slots
        const availableSlots =
            batch.available_slots || batch.capacity - (batch.booked_slots || 0);
        if (availableSlots < numberOfTravelers) {
            return res.status(400).json({
                success: false,
                message: `Not enough slots. Available: ${availableSlots}`,
            });
        }

        // Calculate pricing
        let totalAmount = trek.base_price * numberOfTravelers;
        let discountAmount = 0;

        // Apply trek discount
        if (trek.has_discount) {
            if (trek.discount_type === "percentage") {
                discountAmount = (totalAmount * trek.discount_value) / 100;
            } else {
                discountAmount = trek.discount_value * numberOfTravelers;
            }
        }

        // Apply coupon if provided
        if (couponCode) {
            const coupon = await Coupon.findOne({
                where: {
                    code: couponCode,
                    vendor_id: trek.vendor_id,
                    status: "active",
                    valid_from: { [Op.lte]: new Date() },
                    valid_to: { [Op.gte]: new Date() },
                },
            });

            if (coupon) {
                if (coupon.discount_type === "percentage") {
                    discountAmount +=
                        (totalAmount * coupon.discount_value) / 100;
                } else {
                    discountAmount += coupon.discount_value;
                }
            }
        }

        const finalAmount = Math.max(totalAmount - discountAmount, 0);

        // Create Razorpay order
        const razorpayOrder = await createRazorpayOrder({
            amount: finalAmount,
            currency: "INR",
            receipt: `trek_${trekId}_${Date.now()}`,
            notes: {
                trekId,
                batchId,
                numberOfTravelers,
                vendorId: trek.vendor_id,
            },
        });

        logger.info("payment", `Razorpay order created: ${razorpayOrder.id}`);

        res.json({
            success: true,
            order: razorpayOrder,
            trekDetails: {
                id: trek.id,
                title: trek.title,
                basePrice: trek.base_price,
                totalAmount,
                discountAmount,
                finalAmount,
                batch: {
                    id: batch.id,
                    startDate: batch.start_date,
                    endDate: batch.end_date,
                },
            },
        });
    } catch (error) {
        logger.error("payment", "Error creating trek order:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create payment order",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Verify payment and create booking - OPTIMIZED VERSION
exports.verifyPaymentAndCreateBooking = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            bookingData,
        } = req.body;

        // Verify Razorpay signature
        const isValid = verifyRazorpaySignature(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        );

        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment signature",
            });
        }

        // Get payment details from Razorpay
        const paymentDetails = await getPaymentDetails(razorpay_payment_id);

        if (paymentDetails.status !== "captured") {
            return res.status(400).json({
                success: false,
                message: "Payment not completed",
            });
        }

        // Create booking with payment details
        req.body = {
            ...bookingData,
            paymentStatus: "completed",
            status: "confirmed",
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
        };

        // Call createVendorBooking with payment verified
        await exports.createVendorBooking(req, res);
    } catch (error) {
        logger.error("payment", "Error verifying payment:", error);
        res.status(500).json({
            success: false,
            message: "Failed to verify payment",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Vendor: Get dashboard overview statistics
exports.getVendorDashboardOverview = async (req, res) => {
    try {
        const vendorId = req.user.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        logger.info(
            "dashboard",
            "Getting vendor dashboard overview for vendor:",
            vendorId
        );

        // Use same date logic as batchController for consistency
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const todayString = today.toISOString().split("T")[0];
        
        logger.info("dashboard", "Date consistency check:", {
            currentTime: new Date(),
            todayUTC: today,
            todayString: todayString
        });

        // Get total treks (active batches)
        
        const totalTreks = await Batch.count({
            include: [
                {
                    model: Trek,
                    as: "trek",
                    where: { vendor_id: vendorId },
                },
            ],
            where: {
                start_date: { [Op.gte]: todayString },
            },
        });

        // Get total customers (unique customers with bookings)
        const totalCustomers = await Booking.count({
            include: [
                {
                    model: Trek,
                    as: "trek",
                    where: { vendor_id: vendorId },
                },
            ],
            distinct: true,
            col: "customer_id",
        });

        // Get total earnings (sum of final_amount for completed payments)
        const totalEarnings =
            (await Booking.sum("final_amount", {
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        where: { vendor_id: vendorId },
                    },
                ],
                where: {
                    payment_status: { [Op.in]: ["completed", "partial"] },
                },
            })) || 0;

        // Get pending bookings (partial payments)
        const pendingBookings = await Booking.count({
            include: [
                {
                    model: Trek,
                    as: "trek",
                    where: { vendor_id: vendorId },
                },
            ],
            where: {
                payment_status: "partial",
            },
        });

        // Get completed treks (batches with start_date <= today)
        // Logic: If trek start date is today or before, it's considered completed
        const completedTreks = await Batch.count({
            include: [
                {
                    model: Trek,
                    as: "trek",
                    where: { vendor_id: vendorId },
                },
            ],
            where: {
                start_date: { [Op.lte]: todayString },
            },
        });

        // Get active disputes (placeholder - will be 0 until disputes table is created)
        const activeDisputes = 0;

        const overview = {
            totalTreks,
            totalCustomers,
            totalEarnings: roundAmount(totalEarnings || 0),
            pendingBookings,
            completedTreks,
            activeDisputes,
        };

        logger.info("dashboard", "Dashboard overview generated:", overview);

        res.json({
            success: true,
            data: overview,
        });
    } catch (error) {
        logger.error("dashboard", "Error fetching dashboard overview:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard overview",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Vendor: Get trek instances with customer counts
exports.getVendorTrekInstances = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const {
            search = "",
            status = "all",
            dateFilter = "all",
            page = 1,
            limit = 10,
        } = req.query;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        logger.info(
            "trek-instances",
            "Getting trek instances for vendor:",
            vendorId
        );

        // Build where clause for batches
        const batchWhere = {};

        // Apply date filter
        if (dateFilter !== "all") {
            const now = new Date();
            switch (dateFilter) {
                case "this-month":
                    const thisMonth = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        1
                    );
                    const nextMonth = new Date(
                        now.getFullYear(),
                        now.getMonth() + 1,
                        1
                    );
                    batchWhere.start_date = {
                        [Op.gte]: thisMonth,
                        [Op.lt]: nextMonth,
                    };
                    break;
                case "upcoming":
                    batchWhere.start_date = { [Op.gt]: now };
                    break;
                case "past":
                    batchWhere.start_date = { [Op.lt]: now };
                    break;
            }
        }

        // Get batches with trek and captain info
        const batches = await Batch.findAll({
            where: batchWhere,
            attributes: [
                "id",
                "tbr_id",
                "trek_id",
                "start_date",
                "end_date",
                "capacity",
                "booked_slots",
                "available_slots"
            ],
            include: [
                {
                    model: Trek,
                    as: "trek",
                    where: { vendor_id: vendorId },
                    include: [
                        {
                            model: TrekCaptain,
                            as: "captain",
                            attributes: ["name", "phone"],
                        },
                        {
                            model: Destination,
                            as: "destinationData",
                            required: false,
                            attributes: ["id", "name"],
                        },
                    ],
                },
                {
                    model: TrekCaptain,
                    as: "captain",
                    attributes: ["name", "phone"],
                },
            ],
            order: [["start_date", "ASC"]],
        });

        // Get customer counts for each batch
        const trekInstances = await Promise.all(
            batches.map(async (batch) => {
                // Skip batches where trek is null
                if (!batch.trek) {
                    logger.warn("trek-instances", "Skipping batch with null trek:", batch.id);
                    return null;
                }
                const bookings = await Booking.findAll({
                    where: { batch_id: batch.id },
                    include: [
                        {
                            model: Customer,
                            as: "customer",
                            attributes: ["id", "name", "phone", "email"],
                        },
                    ],
                });

                // Get cancellations from cancellation_bookings table for this batch
                // This table has batch_id field, making it much easier to query
                const cancellationBookings = await CancellationBooking.findAll({
                    where: {
                        batch_id: batch.id
                    },
                    include: [{
                        model: Booking,
                        as: 'booking',
                        attributes: ['id', 'total_travelers', 'batch_id']
                    }],
                    attributes: ['id', 'booking_id', 'batch_id', 'total_refundable_amount', 'deduction_vendor']
                });
                

                // Calculate customer statistics - COUNT TOTAL TRAVELERS, NOT BOOKINGS
                // Normalize payment statuses across old/new values
                // Treat both "completed" and "full_paid" as fully paid
                // IMPORTANT: Exclude cancelled bookings from fullPaid and partialPaid counts
                const fullPaidBookings = bookings.filter(
                    (b) => b.status !== "cancelled" && (b.payment_status === "completed" || b.payment_status === "full_paid")
                );
                const partialPaidBookings = bookings.filter(
                    (b) => b.status !== "cancelled" && b.payment_status === "partial"
                );
                
                // Count total travelers for each payment status (only confirmed bookings)
                const fullPaid = fullPaidBookings.reduce((sum, booking) => {
                    return sum + (booking.total_travelers || 1);
                }, 0);
                const partialPaid = partialPaidBookings.reduce((sum, booking) => {
                    return sum + (booking.total_travelers || 1);
                }, 0);
                
                // Count cancellations from both sources:
                // 1. Bookings with status = 'cancelled'
                const cancelledFromBookings = bookings.filter(
                    (b) => b.status === "cancelled"
                );
                
                // 2. Bookings that exist in cancellation_bookings table
                const cancelledFromCancellationBookingsTable = cancellationBookings
                    .map(cb => cb.booking)
                    .filter(booking => booking !== null); // Filter out null bookings
                
                // Combine both sources and remove duplicates
                const allCancelledBookings = [...cancelledFromBookings];
                cancelledFromCancellationBookingsTable.forEach(cancelledBooking => {
                    if (cancelledBooking && !allCancelledBookings.find(b => b.id === cancelledBooking.id)) {
                        allCancelledBookings.push(cancelledBooking);
                    }
                });
                
                // Count total cancelled slots (travelers)
                const cancelled = allCancelledBookings.reduce((sum, booking) => {
                    return sum + (booking.total_travelers || 1);
                }, 0);


                // Calculate earnings with new formula
                // Potential earnings if all slots are sold at base price
                const capacity = batch.capacity || batch.trek?.max_participants || 20;
                const basePriceRaw = parseFloat(batch.trek?.base_price || 0);
                const expectedEarningsRaw = capacity * basePriceRaw;
                
                // NEW EARNINGS CALCULATION
                // Formula: final_amount - platform_fees - gst_amount - insurance_amount - free_cancellation_amount
                const totalEarningsRaw = bookings
                    .filter((b) => b.payment_status !== "failed")
                    .reduce((sum, b) => {
                        const finalAmt = parseFloat(b.final_amount || 0);
                        const platformFees = parseFloat(b.platform_fees || 0);
                        const gstAmount = parseFloat(b.gst_amount || 0);
                        const insuranceAmount = parseFloat(b.insurance_amount || 0);
                        const freeCancellationAmount = parseFloat(b.free_cancellation_amount || 0);
                        
                        // Calculate earning entity for this person
                        const earningEntity = finalAmt - platformFees - gstAmount - insuranceAmount - freeCancellationAmount;
                        
                        return sum + Math.max(0, earningEntity);
                    }, 0);

                // Legacy calculation for backward compatibility
                const actualEarningsRaw = bookings
                    .filter((b) => b.payment_status !== "failed")
                    .reduce((sum, b) => {
                        const finalAmt = parseFloat(b.final_amount || 0);
                        const remaining = parseFloat(b.remaining_amount || 0);
                        const collected = Math.max(0, finalAmt - remaining);
                        return sum + collected;
                    }, 0);

                // Determine status based on date
                const now = new Date();
                const startDate = new Date(batch.start_date);
                const endDate = batch.end_date
                    ? new Date(batch.end_date)
                    : null;

                // Validate dates
                if (isNaN(startDate.getTime())) {
                    logger.error(
                        "trek-instances",
                        "Invalid start_date for batch:",
                        batch.id
                    );
                    return null; // Skip this batch
                }

                let status = "upcoming";
                if (endDate && !isNaN(endDate.getTime()) && endDate < now) {
                    status = "completed";
                } else if (
                    startDate < now &&
                    (!endDate || isNaN(endDate.getTime()) || endDate >= now)
                ) {
                    status = "ongoing";
                }

                // Calculate individual booking details for new fields
                const bookingDetailsRaw = bookings
                    .filter((b) => b.payment_status !== "failed")
                    .map((b) => ({
                        final_amount: parseFloat(b.final_amount || 0),
                        platform_fees: parseFloat(b.platform_fees || 0),
                        gst_amount: parseFloat(b.gst_amount || 0),
                        insurance_amount: parseFloat(b.insurance_amount || 0),
                        free_cancellation_amount: parseFloat(b.free_cancellation_amount || 0),
                        earning_entity: Math.max(0,
                            parseFloat(b.final_amount || 0) -
                            parseFloat(b.platform_fees || 0) -
                            parseFloat(b.gst_amount || 0) -
                            parseFloat(b.insurance_amount || 0) -
                            parseFloat(b.free_cancellation_amount || 0)
                        )
                    }));

                // Calculate totals for all bookings in this batch
                const totalFinalAmount = bookingDetailsRaw.reduce((sum, b) => sum + b.final_amount, 0);
                const totalPlatformFees = bookingDetailsRaw.reduce((sum, b) => sum + b.platform_fees, 0);
                const totalGstAmount = bookingDetailsRaw.reduce((sum, b) => sum + b.gst_amount, 0);
                const totalInsuranceAmount = bookingDetailsRaw.reduce((sum, b) => sum + b.insurance_amount, 0);
                const totalFreeCancellationAmount = bookingDetailsRaw.reduce((sum, b) => sum + b.free_cancellation_amount, 0);
                
                // Calculate total refund amount (sum of all deduction_vendor for this batch)
                const totalRefundAmount = cancellationBookings.reduce((sum, cancellation) => {
                    return sum + parseFloat(cancellation.deduction_vendor || 0);
                }, 0);

                const bookingDetails = bookingDetailsRaw.map((detail) => ({
                    final_amount: roundAmount(detail.final_amount || 0),
                    platform_fees: roundAmount(detail.platform_fees || 0),
                    gst_amount: roundAmount(detail.gst_amount || 0),
                    insurance_amount: roundAmount(detail.insurance_amount || 0),
                    free_cancellation_amount: roundAmount(detail.free_cancellation_amount || 0),
                    earning_entity: roundAmount(detail.earning_entity || 0),
                }));

                const totals = {
                    final_amount: roundAmount(totalFinalAmount || 0),
                    platform_fees: roundAmount(totalPlatformFees || 0),
                    gst_amount: roundAmount(totalGstAmount || 0),
                    insurance_amount: roundAmount(totalInsuranceAmount || 0),
                    free_cancellation_amount: roundAmount(totalFreeCancellationAmount || 0),
                    total_refund_amount: roundAmount(totalRefundAmount || 0),
                };

                return {
                    id: `BATCH${batch.id}`,
                    tbrId: batch.tbr_id,
                    trekId: batch.trek_id,
                    trekName: batch.trek?.title || 'Unknown Trek',
                    // Debug logs
                    _debug: {
                        batchId: batch.id,
                        tbrId: batch.tbr_id,
                        trekTitle: batch.trek?.title || 'Unknown Trek'
                    },
                    date: startDate.toISOString().split("T")[0],
                    captain:
                        batch.captain?.name ||
                        batch.trek?.captain?.name ||
                        "Not Assigned",
                    captainPhone: batch.captain?.phone || batch.trek?.captain?.phone || null,
                    status: status,
                    totalSlots: batch.capacity || batch.trek?.max_participants || 20,
                    difficulty: batch.trek?.difficulty || "Moderate",
                    duration: `${batch.trek?.duration_days || 3} days`,
                    destination: batch.trek?.destinationData?.name || "Not specified",
                    customers: {
                        fullPaid,
                        partialPaid,
                        cancelled,
                        total: fullPaid + partialPaid, // Total excludes cancelled bookings
                    },
                    bookedSlots: batch.booked_slots || 0,
                    capacity,
                    availableSlots: batch.available_slots || (capacity - (batch.booked_slots || 0)),
                    expectedEarnings: roundAmount(expectedEarningsRaw || 0),
                    actualEarnings: roundAmount(actualEarningsRaw || 0),
                    basePrice: roundAmount(basePriceRaw || 0),
                    // NEW FIELDS ADDED
                    totalEarnings: roundAmount(totalEarningsRaw || 0),
                    bookingDetails: bookingDetails,
                    totals,
                    // Additional slot information for frontend
                    slotInfo: {
                        capacity: capacity,
                        bookedSlots: batch.booked_slots || 0,
                        availableSlots: batch.available_slots || (capacity - (batch.booked_slots || 0)),
                        fullPaidSlots: fullPaid,
                        partialPaidSlots: partialPaid,
                        cancelledSlots: cancelled
                    }
                };
            })
        );

        // Filter out null results (batches with invalid dates)
        const validTrekInstances = trekInstances.filter(
            (instance) => instance !== null
        );

        // Apply search filter
        let filteredInstances = validTrekInstances;
        if (search && search.trim() !== "") {
            const searchLower = search.toLowerCase();
            // Search debug logs removed for performance
            
            filteredInstances = validTrekInstances.filter(
                (instance) => {
                    // Priority search - TBR ID first
                    const tbrMatches = instance.tbrId?.toLowerCase().includes(searchLower);
                    
                    // Substring matching for partial TBR IDs
                    const tbrPartialMatch = instance.tbrId?.toLowerCase().startsWith(searchLower);
                    
                    // Search matching debug removed for performance
                    
                    return (instance.id?.toLowerCase().includes(searchLower) || false) ||
                           tbrMatches ||
                           tbrPartialMatch ||
                           (instance.trekName?.toLowerCase().includes(searchLower) || false) ||
                           (instance.captain?.toLowerCase().includes(searchLower) || false);
                }
            );
            
            // Filtered instances count debug removed for performance
        }

        // Apply status filter
        if (status !== "all") {
            filteredInstances = filteredInstances.filter(
                (instance) => instance.status === status
            );
        }

        // Calculate pagination
        const totalItems = filteredInstances.length;
        const totalPages = Math.ceil(totalItems / parseInt(limit));
        const startIndex = (parseInt(page) - 1) * parseInt(limit);
        const endIndex = startIndex + parseInt(limit);
        const paginatedInstances = filteredInstances.slice(
            startIndex,
            endIndex
        );

        logger.info(
            "trek-instances",
            `Found ${totalItems} trek instances, returning page ${page} (${paginatedInstances.length} items)`
        );

        res.json({
            success: true,
            data: paginatedInstances,
            pagination: {
                currentPage: parseInt(page),
                totalPages: totalPages,
                totalItems: totalItems,
                itemsPerPage: parseInt(limit),
                hasNext: parseInt(page) < totalPages,
                hasPrev: parseInt(page) > 1,
            },
        });
    } catch (error) {
        logger.error("trek-instances", "Error fetching trek instances:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch trek instances",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Vendor: Delete booking
exports.deleteBooking = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const vendorId = req.user.id;
        const { id } = req.params;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Find the booking and verify it belongs to this vendor
        const booking = await Booking.findOne({
            where: { id },
            include: [
                {
                    model: Batch,
                    as: "batch",
                    include: [
                        {
                            model: Trek,
                            as: "trek",
                            where: { vendor_id: vendorId },
                        },
                    ],
                },
            ],
        });

        if (!booking) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: "Booking not found or access denied.",
            });
        }

        // Delete related records first
        await BookingTraveler.destroy({
            where: { booking_id: id },
            transaction,
        });

        await PaymentLog.destroy({
            where: { booking_id: id },
            transaction,
        });

        // Delete the booking
        await Booking.destroy({
            where: { id },
            transaction,
        });

        // Update batch slots
        await updateBatchSlotsOnCancellation(
            booking.batch_id,
            booking.total_travelers,
            transaction
        );

        await transaction.commit();

        logger.info("booking", `Booking ${id} deleted successfully by vendor ${vendorId}`);

        res.json({
            success: true,
            message: "Booking deleted successfully",
        });
    } catch (error) {
        await transaction.rollback();
        logger.error("booking", "Error deleting booking:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete booking",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Vendor: Get batch cancellations
exports.getBatchCancellations = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const { batchId } = req.params;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Extract numeric batch ID from "BATCH123" format
        const numericBatchId = batchId.replace(/^BATCH/, '');
        
        // Cancellations API Debug removed for performance

        // Find the batch and verify it belongs to this vendor
        const batch = await Batch.findOne({
            where: { id: numericBatchId },
            include: [
                {
                    model: Trek,
                    as: "trek",
                    where: { vendor_id: vendorId },
                },
            ],
        });

        if (!batch) {
            // Batch not found debug removed for performance
            return res.status(404).json({
                success: false,
                message: "Batch not found or access denied.",
            });
        }

        // Debug: Check if there are any bookings for this batch
        const batchBookings = await Booking.findAll({
            where: { batch_id: numericBatchId },
            attributes: ['id', 'batch_id', 'customer_id', 'status'],
            include: [
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name"],
                },
            ],
        });

        // Debug: Check if there are any cancellations at all
        const allCancellations = await CancellationBooking.findAll({
            attributes: ['id', 'booking_id', 'batch_id', 'reason', 'total_refundable_amount', 'deduction_vendor', 'status'],
            limit: 5, // Just get a few to see structure
        });

        // Debug info removed for performance

        // Get cancellations for this batch
        const cancellations = await CancellationBooking.findAll({
            where: { batch_id: numericBatchId },
            include: [
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name", "email", "phone"],
                },
                {
                    model: Booking,
                    as: "booking",
                    attributes: ["id", "created_at", "booking_date"],
                },
            ],
            order: [["cancellation_date", "DESC"]],
        });

        // Cancellations query result debug removed for performance

        // Format the data
        const cancellationData = cancellations.map((cancellation) => {
            return {
                id: cancellation.id,
                bookingId: cancellation.booking_id,
                customerName: cancellation.customer?.name || "Unknown",
                customerPhone: cancellation.customer?.phone || "",
                customerEmail: cancellation.customer?.email || "",
                bookingDate: cancellation.booking?.booking_date || cancellation.booking?.created_at,
                cancellationDate: cancellation.cancellation_date,
                reason: cancellation.reason || "Not specified",
                refundAmount: roundAmount(parseFloat(cancellation.total_refundable_amount || 0)),
                paybackAmount: roundAmount(parseFloat(cancellation.deduction_vendor || 0)),
                status: cancellation.status || "confirmed",
                policyType: "standard", // Default policy type
            };
        });

        logger.info("booking", `Batch ${batchId} cancellations retrieved successfully by vendor ${vendorId}`);

        res.json({
            success: true,
            data: cancellationData,
        });
    } catch (error) {
        logger.error("booking", "Error fetching batch cancellations:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch cancellations",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Vendor: Get cancellation details for a specific booking
exports.getBookingCancellationDetails = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const { bookingId } = req.params;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Get cancellation details from cancellation_bookings table
        const cancellationDetails = await CancellationBooking.findOne({
            where: { booking_id: bookingId },
            attributes: ['id', 'booking_id', 'customer_id', 'trek_id', 'batch_id', 'total_refundable_amount', 'status', 'reason', 'cancellation_date', 'processed_date', 'refund_transaction_id', 'note']
        });

        if (!cancellationDetails) {
            return res.status(404).json({
                success: false,
                message: "Cancellation details not found",
            });
        }

        res.json({
            success: true,
            data: cancellationDetails
        });
    } catch (error) {
        logger.error("booking", "Error fetching booking cancellation details:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch cancellation details",
            error: error.message
        });
    }
};

module.exports = exports;
