const {
    Booking,
    Trek,
    Customer,
    Vendor,
    Rating,
    Batch,
    BookingTraveler,
    sequelize,
} = require("../../models");
const { Op } = require("sequelize");
const logger = require("../../utils/logger");
const { roundAmount, roundAmountsInObject } = require("../../utils/amountUtils");

// Get vendor dashboard analytics with real-time data
exports.getVendorDashboard = async (req, res) => {
    try {
        const vendorId = req.user.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Get current date and calculate date ranges
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(
            now.getFullYear(),
            now.getMonth() - 1,
            1
        );
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        // Parallel database queries for better performance
        const [
            activeTreksCount,
            currentMonthBookings,
            lastMonthBookings,
            currentMonthRevenue,
            lastMonthRevenue,
            averageRating,
            totalReviews,
            upcomingTreks,
            recentBookings,
            recentReviews,
        ] = await Promise.all([
            // 1. Active Treks Count
            Trek.count({
                where: {
                    vendor_id: vendorId,
                    status: "active",
                },
            }),

            // 2. Total Bookings (current month)
            Booking.count({
                where: {
                    vendor_id: vendorId,
                    created_at: {
                        [Op.gte]: startOfMonth,
                    },
                },
            }),

            // 3. Total Bookings (last month)
            Booking.count({
                where: {
                    vendor_id: vendorId,
                    created_at: {
                        [Op.between]: [startOfLastMonth, endOfLastMonth],
                    },
                },
            }),

            // 4. Monthly Revenue (current month)
            Booking.sum("total_amount", {
                where: {
                    vendor_id: vendorId,
                    payment_status: "completed",
                    created_at: {
                        [Op.gte]: startOfMonth,
                    },
                },
            }),

            // 5. Monthly Revenue (last month)
            Booking.sum("total_amount", {
                where: {
                    vendor_id: vendorId,
                    payment_status: "completed",
                    created_at: {
                        [Op.between]: [startOfLastMonth, endOfLastMonth],
                    },
                },
            }),

            // 6. Average Rating
            Rating.findOne({
                attributes: [
                    [
                        sequelize.fn(
                            "AVG",
                            sequelize.col("Rating.rating_value")
                        ),
                        "averageRating",
                    ],
                    [
                        sequelize.fn("COUNT", sequelize.col("Rating.id")),
                        "totalReviews",
                    ],
                ],
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        where: { vendor_id: vendorId },
                        attributes: [],
                    },
                ],
            }),

            // 7. Total Reviews Count
            Rating.count({
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        where: { vendor_id: vendorId },
                        attributes: [],
                    },
                ],
            }),

            // 8. Upcoming Treks (next 30 days) - Each batch treated as separate trek
            Trek.findAll({
                where: {
                    vendor_id: vendorId,
                    status: "active",
                },
                include: [
                    {
                        model: Batch,
                        as: "batches",
                        where: {
                            start_date: {
                                [Op.gte]: now,
                            },
                        },
                        required: true,
                    },
                ],
                limit: 10, // Increased limit since we'll have multiple batches per trek
                order: [["created_at", "DESC"]],
            }),

            // 9. Recent Bookings (last 10)
            Booking.findAll({
                where: {
                    vendor_id: vendorId,
                },
                include: [
                    {
                        model: Customer,
                        as: "customer",
                        attributes: ["id", "name", "email"],
                    },
                    {
                        model: Trek,
                        as: "trek",
                        attributes: ["id", "title"],
                    },
                ],
                limit: 10,
                order: [["created_at", "DESC"]],
            }),

            // 10. Recent Reviews (last 5)
            Rating.findAll({
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        where: { vendor_id: vendorId },
                        attributes: ["id", "title"],
                    },
                    {
                        model: Customer,
                        as: "customer",
                        attributes: ["id", "name"],
                    },
                ],
                limit: 5,
                order: [["created_at", "DESC"]],
            }),
        ]);

        // Calculate trends
        const bookingGrowth =
            lastMonthBookings > 0
                ? ((currentMonthBookings - lastMonthBookings) /
                      lastMonthBookings) *
                  100
                : 0;

        const revenueGrowth =
            lastMonthRevenue > 0
                ? ((currentMonthRevenue - lastMonthRevenue) /
                      lastMonthRevenue) *
                  100
                : 0;

        // Format response data
        const dashboardData = {
            overview: {
                active_treks: activeTreksCount,
                total_bookings: currentMonthBookings,
                monthly_revenue: roundAmount(currentMonthRevenue || 0),
                average_rating: parseFloat(
                    averageRating?.dataValues?.averageRating || 0
                ).toFixed(1),
                total_reviews: totalReviews,
            },
            trends: {
                revenue_growth: parseFloat(revenueGrowth).toFixed(2),
                booking_growth: parseFloat(bookingGrowth).toFixed(2),
                rating_trend: parseFloat(
                    averageRating?.dataValues?.averageRating || 0
                ).toFixed(1),
            },
            upcoming_treks: upcomingTreks
                .flatMap(
                    (trek) =>
                        trek.batches?.map((batch) => ({
                            id: `${trek.id}_${batch.id}`, // Unique ID combining trek and batch
                            trek_id: trek.id,
                            batch_id: batch.id,
                            title: `${trek.title} - Batch ${batch.tbr_id}`, // Include batch identifier
                            start_date: batch.start_date,
                            end_date: batch.end_date,
                            booked_slots: batch.booked_slots || 0,
                            total_slots: batch.capacity || 0,
                            available_slots: batch.available_slots || 0,
                            trek_duration: trek.duration,
                            trek_difficulty: trek.difficulty,
                            trek_type: trek.trek_type,
                            base_price: roundAmount(trek.base_price || 0),
                        })) || []
                )
                .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
                .slice(0, 5), // Sort by date and limit to 5
            recent_bookings: recentBookings.map((booking) => ({
                id: booking.id,
                booking_id: booking.id, // Use the same id as booking_id
                customer_name: booking.customer?.name,
                trek_title: booking.trek?.title,
                amount: roundAmount(booking.total_amount || 0),
                final_amount: roundAmount(booking.final_amount || 0),
                status: booking.status,
                payment_status: booking.payment_status,
                total_travelers: booking.total_travelers,
                created_at: booking.created_at,
            })),
            recent_reviews: recentReviews.map((review) => ({
                id: review.id,
                customer_name: review.customer?.name,
                trek_title: review.trek?.title,
                title: review.title,
                content: review.content,
                rating: review.rating_value || 0, // Use rating_value from Rating model
                is_verified: review.is_verified,
                is_approved: review.is_approved,
                status: review.status,
                created_at: review.created_at,
            })),
        };

        logger.info("vendor", "Dashboard analytics retrieved successfully", {
            vendorId,
            activeTreks: activeTreksCount,
            totalBookings: currentMonthBookings,
            monthlyRevenue: currentMonthRevenue,
        });

        res.json({
            success: true,
            data: dashboardData,
        });
    } catch (error) {
        logger.error("vendor", "Failed to get dashboard analytics", {
            error: error.message,
            stack: error.stack,
            vendorId: req.user?.id,
        });

        res.status(500).json({
            success: false,
            message: "Failed to retrieve dashboard analytics",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Get detailed revenue analytics
exports.getRevenueAnalytics = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const { period = "month", group_by = "day" } = req.query;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Calculate date range based on period
        const now = new Date();
        let startDate, endDate;

        switch (period) {
            case "week":
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                endDate = now;
                break;
            case "month":
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = now;
                break;
            case "quarter":
                startDate = new Date(
                    now.getFullYear(),
                    Math.floor(now.getMonth() / 3) * 3,
                    1
                );
                endDate = now;
                break;
            case "year":
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = now;
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = now;
        }

        // Get revenue data
        const [
            totalRevenue,
            currentPeriodRevenue,
            previousPeriodRevenue,
            revenueByTrek,
            revenueByPaymentMethod,
        ] = await Promise.all([
            // Total revenue
            Booking.sum("total_amount", {
                where: {
                    vendor_id: vendorId,
                    payment_status: "completed",
                },
            }),

            // Current period revenue
            Booking.sum("total_amount", {
                where: {
                    vendor_id: vendorId,
                    payment_status: "completed",
                    created_at: {
                        [Op.between]: [startDate, endDate],
                    },
                },
            }),

            // Previous period revenue
            Booking.sum("total_amount", {
                where: {
                    vendor_id: vendorId,
                    payment_status: "completed",
                    created_at: {
                        [Op.between]: [
                            new Date(
                                startDate.getTime() -
                                    (endDate.getTime() - startDate.getTime())
                            ),
                            startDate,
                        ],
                    },
                },
            }),

            // Revenue by trek
            Booking.findAll({
                attributes: [
                    "trek_id",
                    [
                        sequelize.fn(
                            "SUM",
                            sequelize.col("Booking.total_amount")
                        ),
                        "revenue",
                    ],
                    [
                        sequelize.fn("COUNT", sequelize.col("Booking.id")),
                        "bookings",
                    ],
                ],
                where: {
                    vendor_id: vendorId,
                    payment_status: "completed",
                    created_at: {
                        [Op.between]: [startDate, endDate],
                    },
                },
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        attributes: ["id", "title"],
                    },
                ],
                group: ["trek_id"],
                order: [
                    [
                        sequelize.fn(
                            "SUM",
                            sequelize.col("Booking.total_amount")
                        ),
                        "DESC",
                    ],
                ],
                limit: 10,
            }),

            // Revenue by payment method
            Booking.findAll({
                attributes: [
                    "payment_method",
                    [
                        sequelize.fn(
                            "SUM",
                            sequelize.col("Booking.total_amount")
                        ),
                        "revenue",
                    ],
                    [
                        sequelize.fn("COUNT", sequelize.col("Booking.id")),
                        "count",
                    ],
                ],
                where: {
                    vendor_id: vendorId,
                    payment_status: "completed",
                    created_at: {
                        [Op.between]: [startDate, endDate],
                    },
                },
                group: ["payment_method"],
            }),
        ]);

        // Calculate growth percentage
        const growthPercentage =
            previousPeriodRevenue > 0
                ? ((currentPeriodRevenue - previousPeriodRevenue) /
                      previousPeriodRevenue) *
                  100
                : 0;

        // Calculate average booking value
        const totalBookings = await Booking.count({
            where: {
                vendor_id: vendorId,
                payment_status: "completed",
                created_at: {
                    [Op.between]: [startDate, endDate],
                },
            },
        });

        const averageBookingValue =
            totalBookings > 0 ? currentPeriodRevenue / totalBookings : 0;

        // Generate trends data
        const trends = [];
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const dayStart = new Date(currentDate);
            const dayEnd = new Date(currentDate);
            dayEnd.setDate(dayEnd.getDate() + 1);

            const dayRevenue = await Booking.sum("total_amount", {
                where: {
                    vendor_id: vendorId,
                    payment_status: "completed",
                    created_at: {
                        [Op.between]: [dayStart, dayEnd],
                    },
                },
            });

            const dayBookings = await Booking.count({
                where: {
                    vendor_id: vendorId,
                    created_at: {
                        [Op.between]: [dayStart, dayEnd],
                    },
                },
            });

            trends.push({
                date: currentDate.toISOString().split("T")[0],
                revenue: dayRevenue || 0,
                bookings: dayBookings,
            });

            currentDate.setDate(currentDate.getDate() + 1);
        }

        const analyticsData = {
            summary: {
                total_revenue: roundAmount(totalRevenue || 0),
                current_period_revenue: roundAmount(currentPeriodRevenue || 0),
                previous_period_revenue: roundAmount(previousPeriodRevenue || 0),
                growth_percentage: parseFloat(growthPercentage).toFixed(2),
                average_booking_value: roundAmount(averageBookingValue || 0),
            },
            trends: trends.map((trend) => ({
                ...trend,
                revenue: roundAmount(trend.revenue || 0),
            })),
            by_trek: revenueByTrek.map((item) => ({
                trek_id: item.trek_id,
                trek_title: item.trek?.title,
                revenue: roundAmount(parseFloat(item.dataValues.revenue) || 0),
                bookings: item.dataValues.bookings,
                average_rating: 0, // TODO: Add rating calculation
            })),
            by_payment_method: revenueByPaymentMethod.map((item) => ({
                method: item.payment_method,
                revenue: roundAmount(parseFloat(item.dataValues.revenue) || 0),
                count: item.dataValues.count,
            })),
        };

        logger.info("vendor", "Revenue analytics retrieved successfully", {
            vendorId,
            period,
            totalRevenue,
            currentPeriodRevenue,
        });

        res.json({
            success: true,
            data: analyticsData,
        });
    } catch (error) {
        logger.error("vendor", "Failed to get revenue analytics", {
            error: error.message,
            stack: error.stack,
            vendorId: req.user?.id,
        });

        res.status(500).json({
            success: false,
            message: "Failed to retrieve revenue analytics",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Get booking analytics
exports.getBookingAnalytics = async (req, res) => {
    try {
        const vendorId = req.user.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Get current month data
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [
            totalBookings,
            confirmedBookings,
            pendingBookings,
            cancelledBookings,
            statusDistribution,
            bookingsByTrek,
        ] = await Promise.all([
            // Total bookings
            Booking.count({
                where: { vendor_id: vendorId },
            }),

            // Confirmed bookings
            Booking.count({
                where: {
                    vendor_id: vendorId,
                    status: "confirmed",
                },
            }),

            // Pending bookings
            Booking.count({
                where: {
                    vendor_id: vendorId,
                    status: "pending",
                },
            }),

            // Cancelled bookings
            Booking.count({
                where: {
                    vendor_id: vendorId,
                    status: "cancelled",
                },
            }),

            // Status distribution
            Booking.findAll({
                attributes: [
                    "status",
                    [
                        sequelize.fn("COUNT", sequelize.col("Booking.id")),
                        "count",
                    ],
                ],
                where: { vendor_id: vendorId },
                group: ["status"],
            }),

            // Bookings by trek
            Booking.findAll({
                attributes: [
                    "trek_id",
                    [
                        sequelize.fn("COUNT", sequelize.col("Booking.id")),
                        "bookings",
                    ],
                    [
                        sequelize.fn(
                            "SUM",
                            sequelize.col("Booking.total_amount")
                        ),
                        "revenue",
                    ],
                ],
                where: { vendor_id: vendorId },
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        attributes: ["id", "title"],
                    },
                ],
                group: ["trek_id"],
                order: [
                    [
                        sequelize.fn("COUNT", sequelize.col("Booking.id")),
                        "DESC",
                    ],
                ],
                limit: 10,
            }),
        ]);

        // Calculate conversion rate
        const conversionRate =
            totalBookings > 0 ? (confirmedBookings / totalBookings) * 100 : 0;

        // Generate monthly trends
        const trends = [];
        for (let i = 5; i >= 0; i--) {
            const monthStart = new Date(
                now.getFullYear(),
                now.getMonth() - i,
                1
            );
            const monthEnd = new Date(
                now.getFullYear(),
                now.getMonth() - i + 1,
                0
            );

            const monthBookings = await Booking.count({
                where: {
                    vendor_id: vendorId,
                    created_at: {
                        [Op.between]: [monthStart, monthEnd],
                    },
                },
            });

            const monthRevenue = await Booking.sum("total_amount", {
                where: {
                    vendor_id: vendorId,
                    payment_status: "completed",
                    created_at: {
                        [Op.between]: [monthStart, monthEnd],
                    },
                },
            });

            trends.push({
                date: monthStart.toISOString().slice(0, 7), // YYYY-MM format
                bookings: monthBookings,
                revenue: roundAmount(monthRevenue || 0),
            });
        }

        const analyticsData = {
            summary: {
                total_bookings: totalBookings,
                confirmed_bookings: confirmedBookings,
                pending_bookings: pendingBookings,
                cancelled_bookings: cancelledBookings,
                conversion_rate: parseFloat(conversionRate).toFixed(2),
            },
            status_distribution: statusDistribution.map((item) => ({
                status: item.status,
                count: item.dataValues.count,
                percentage:
                    totalBookings > 0
                        ? (
                              (item.dataValues.count / totalBookings) *
                              100
                          ).toFixed(2)
                        : 0,
            })),
            trends: trends,
            by_trek: bookingsByTrek.map((item) => ({
                trek_id: item.trek_id,
                trek_title: item.trek?.title,
                bookings: item.dataValues.bookings,
                revenue: roundAmount(parseFloat(item.dataValues.revenue || 0)),
                occupancy_rate: 0, // TODO: Calculate occupancy rate
            })),
        };

        logger.info("vendor", "Booking analytics retrieved successfully", {
            vendorId,
            totalBookings,
            confirmedBookings,
            conversionRate,
        });

        res.json({
            success: true,
            data: analyticsData,
        });
    } catch (error) {
        logger.error("vendor", "Failed to get booking analytics", {
            error: error.message,
            stack: error.stack,
            vendorId: req.user?.id,
        });

        res.status(500).json({
            success: false,
            message: "Failed to retrieve booking analytics",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Get customer analytics
exports.getCustomerAnalytics = async (req, res) => {
    try {
        const vendorId = req.user.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Get current month data
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [
            totalCustomers,
            newCustomers,
            repeatCustomers,
            topCustomers,
            customerSatisfaction,
        ] = await Promise.all([
            // Total customers
            Customer.count({
                include: [
                    {
                        model: Booking,
                        as: "bookings",
                        where: { vendor_id: vendorId },
                        required: true,
                    },
                ],
            }),

            // New customers this month
            Customer.count({
                include: [
                    {
                        model: Booking,
                        as: "bookings",
                        where: {
                            vendor_id: vendorId,
                            created_at: {
                                [Op.gte]: startOfMonth,
                            },
                        },
                        required: true,
                    },
                ],
                where: {
                    created_at: {
                        [Op.gte]: startOfMonth,
                    },
                },
            }),

            // Repeat customers (customers with more than 1 booking)
            Customer.count({
                include: [
                    {
                        model: Booking,
                        as: "bookings",
                        where: { vendor_id: vendorId },
                        required: true,
                    },
                ],
                having: sequelize.literal("COUNT(bookings.id) > 1"),
                group: ["Customer.id"],
            }),

            // Top customers
            Customer.findAll({
                include: [
                    {
                        model: Booking,
                        as: "bookings",
                        where: { vendor_id: vendorId },
                        required: true,
                        attributes: [
                            [
                                sequelize.fn(
                                    "COUNT",
                                    sequelize.col("bookings.id")
                                ),
                                "total_bookings",
                            ],
                            [
                                sequelize.fn(
                                    "SUM",
                                    sequelize.col("bookings.total_amount")
                                ),
                                "total_spent",
                            ],
                            [
                                sequelize.fn(
                                    "MAX",
                                    sequelize.col("bookings.created_at")
                                ),
                                "last_booking",
                            ],
                        ],
                    },
                ],
                group: ["Customer.id"],
                order: [
                    [
                        sequelize.fn(
                            "SUM",
                            sequelize.col("bookings.total_amount")
                        ),
                        "DESC",
                    ],
                ],
                limit: 10,
            }),

            // Customer satisfaction (average rating)
            Rating.findOne({
                attributes: [
                    [
                        sequelize.fn(
                            "AVG",
                            sequelize.col("Rating.rating_value")
                        ),
                        "average_rating",
                    ],
                    [
                        sequelize.fn("COUNT", sequelize.col("Rating.id")),
                        "total_reviews",
                    ],
                ],
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        where: { vendor_id: vendorId },
                        attributes: [],
                    },
                ],
            }),
        ]);

        // Calculate retention rate
        const retentionRate =
            totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;

        // Calculate average customer value
        const totalRevenue = await Booking.sum("total_amount", {
            where: {
                vendor_id: vendorId,
                payment_status: "completed",
            },
        });

        const averageCustomerValue =
            totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

        // Generate customer trends
        const trends = [];
        for (let i = 5; i >= 0; i--) {
            const monthStart = new Date(
                now.getFullYear(),
                now.getMonth() - i,
                1
            );
            const monthEnd = new Date(
                now.getFullYear(),
                now.getMonth() - i + 1,
                0
            );

            const monthNewCustomers = await Customer.count({
                include: [
                    {
                        model: Booking,
                        as: "bookings",
                        where: {
                            vendor_id: vendorId,
                            created_at: {
                                [Op.between]: [monthStart, monthEnd],
                            },
                        },
                        required: true,
                    },
                ],
                where: {
                    created_at: {
                        [Op.between]: [monthStart, monthEnd],
                    },
                },
            });

            const monthRepeatCustomers = await Customer.count({
                include: [
                    {
                        model: Booking,
                        as: "bookings",
                        where: {
                            vendor_id: vendorId,
                            created_at: {
                                [Op.between]: [monthStart, monthEnd],
                            },
                        },
                        required: true,
                    },
                ],
                having: sequelize.literal("COUNT(bookings.id) > 1"),
                group: ["Customer.id"],
            });

            trends.push({
                date: monthStart.toISOString().slice(0, 7),
                new_customers: monthNewCustomers,
                repeat_customers: monthRepeatCustomers,
            });
        }

        const analyticsData = {
            overview: {
                total_customers: totalCustomers,
                active_customers: totalCustomers, // TODO: Define active customers
                new_customers: newCustomers,
                repeat_customers: repeatCustomers,
                retention_rate: parseFloat(retentionRate).toFixed(2),
                average_customer_value: roundAmount(averageCustomerValue || 0),
            },
            trends: {
                customer_growth: 0, // TODO: Calculate growth
                retention_rate: parseFloat(retentionRate).toFixed(2),
                average_booking_frequency: 0, // TODO: Calculate frequency
            },
            top_customers: topCustomers.map((customer) => ({
                customer_id: customer.id,
                name: customer.name,
                total_bookings: parseInt(
                    customer.bookings?.[0]?.dataValues?.total_bookings || 0
                ),
                total_spent: roundAmount(
                    parseFloat(customer.bookings?.[0]?.dataValues?.total_spent || 0)
                ),
                last_booking: customer.bookings?.[0]?.dataValues?.last_booking,
            })),
            customer_satisfaction: {
                average_rating: parseFloat(
                    customerSatisfaction?.dataValues?.average_rating || 0
                ).toFixed(1),
                total_reviews:
                    customerSatisfaction?.dataValues?.total_reviews || 0,
                rating_distribution: [], // TODO: Add rating distribution
            },
            customer_trends: trends,
        };

        logger.info("vendor", "Customer analytics retrieved successfully", {
            vendorId,
            totalCustomers,
            newCustomers,
            retentionRate,
        });

        res.json({
            success: true,
            data: analyticsData,
        });
    } catch (error) {
        logger.error("vendor", "Failed to get customer analytics", {
            error: error.message,
            stack: error.stack,
            vendorId: req.user?.id,
        });

        res.status(500).json({
            success: false,
            message: "Failed to retrieve customer analytics",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Get trek performance analytics
exports.getTrekPerformanceAnalytics = async (req, res) => {
    try {
        const vendorId = req.user.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        const [
            totalTreks,
            activeTreks,
            averageRating,
            totalRevenue,
            topPerformingTreks,
            trekAnalytics,
        ] = await Promise.all([
            // Total treks
            Trek.count({
                where: { vendor_id: vendorId },
            }),

            // Active treks
            Trek.count({
                where: {
                    vendor_id: vendorId,
                    status: "active",
                },
            }),

            // Average rating
            Rating.findOne({
                attributes: [
                    [
                        sequelize.fn(
                            "AVG",
                            sequelize.col("Rating.rating_value")
                        ),
                        "average_rating",
                    ],
                ],
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        where: { vendor_id: vendorId },
                        attributes: [],
                    },
                ],
            }),

            // Total revenue
            Booking.sum("total_amount", {
                where: {
                    vendor_id: vendorId,
                    payment_status: "completed",
                },
            }),

            // Top performing treks
            Trek.findAll({
                where: { vendor_id: vendorId },
                include: [
                    {
                        model: Booking,
                        as: "bookings",
                        attributes: [
                            [
                                sequelize.fn(
                                    "COUNT",
                                    sequelize.col("bookings.id")
                                ),
                                "total_bookings",
                            ],
                            [
                                sequelize.fn(
                                    "SUM",
                                    sequelize.col("bookings.total_amount")
                                ),
                                "total_revenue",
                            ],
                        ],
                    },
                    {
                        model: Rating,
                        as: "ratings",
                        attributes: [
                            [
                                sequelize.fn(
                                    "AVG",
                                    sequelize.col("ratings.rating_value")
                                ),
                                "average_rating",
                            ],
                        ],
                    },
                ],
                group: ["Trek.id"],
                order: [
                    [
                        sequelize.fn(
                            "SUM",
                            sequelize.col("bookings.total_amount")
                        ),
                        "DESC",
                    ],
                ],
                limit: 10,
            }),

            // All trek analytics
            Trek.findAll({
                where: { vendor_id: vendorId },
                include: [
                    {
                        model: Booking,
                        as: "bookings",
                        attributes: [
                            [
                                sequelize.fn(
                                    "COUNT",
                                    sequelize.col("bookings.id")
                                ),
                                "total_bookings",
                            ],
                            [
                                sequelize.fn(
                                    "SUM",
                                    sequelize.col("bookings.total_amount")
                                ),
                                "total_revenue",
                            ],
                        ],
                    },
                    {
                        model: Rating,
                        as: "ratings",
                        attributes: [
                            [
                                sequelize.fn(
                                    "AVG",
                                    sequelize.col("ratings.rating_value")
                                ),
                                "average_rating",
                            ],
                            [
                                sequelize.fn(
                                    "COUNT",
                                    sequelize.col("ratings.id")
                                ),
                                "review_count",
                            ],
                        ],
                    },
                ],
                group: ["Trek.id"],
            }),
        ]);

        const analyticsData = {
            summary: {
                total_treks: totalTreks,
                active_treks: activeTreks,
                average_rating: parseFloat(
                    averageRating?.dataValues?.average_rating || 0
                ).toFixed(1),
                total_revenue: roundAmount(totalRevenue || 0),
            },
            top_performing_treks: topPerformingTreks.map((trek) => ({
                trek_id: trek.id,
                title: trek.title,
                bookings: parseInt(
                    trek.bookings?.[0]?.dataValues?.total_bookings || 0
                ),
                revenue: roundAmount(
                    parseFloat(trek.bookings?.[0]?.dataValues?.total_revenue || 0)
                ),
                rating: parseFloat(
                    trek.ratings?.[0]?.dataValues?.average_rating || 0
                ).toFixed(1),
                occupancy_rate: 0, // TODO: Calculate occupancy rate
            })),
            trek_analytics: trekAnalytics.map((trek) => ({
                trek_id: trek.id,
                title: trek.title,
                total_bookings: parseInt(
                    trek.bookings?.[0]?.dataValues?.total_bookings || 0
                ),
                total_revenue: roundAmount(
                    parseFloat(trek.bookings?.[0]?.dataValues?.total_revenue || 0)
                ),
                average_rating: parseFloat(
                    trek.ratings?.[0]?.dataValues?.average_rating || 0
                ).toFixed(1),
                review_count: trek.ratings?.[0]?.dataValues?.review_count || 0,
                occupancy_rate: 0, // TODO: Calculate occupancy rate
                profit_margin: 0, // TODO: Calculate profit margin
            })),
        };

        logger.info(
            "vendor",
            "Trek performance analytics retrieved successfully",
            {
                vendorId,
                totalTreks,
                activeTreks,
                totalRevenue,
            }
        );

        res.json({
            success: true,
            data: analyticsData,
        });
    } catch (error) {
        logger.error("vendor", "Failed to get trek performance analytics", {
            error: error.message,
            stack: error.stack,
            vendorId: req.user?.id,
        });

        res.status(500).json({
            success: false,
            message: "Failed to retrieve trek performance analytics",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Get real-time metrics
exports.getRealTimeMetrics = async (req, res) => {
    try {
        const vendorId = req.user.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const [todayBookings, todayRevenue, pendingBookings, upcomingTreks] =
            await Promise.all([
                // Today's bookings
                Booking.count({
                    where: {
                        vendor_id: vendorId,
                        created_at: {
                            [Op.between]: [today, tomorrow],
                        },
                    },
                }),

                // Today's revenue
                Booking.sum("total_amount", {
                    where: {
                        vendor_id: vendorId,
                        payment_status: "completed",
                        created_at: {
                            [Op.between]: [today, tomorrow],
                        },
                    },
                }),

                // Pending bookings
                Booking.count({
                    where: {
                        vendor_id: vendorId,
                        status: "pending",
                    },
                }),

                // Upcoming treks (next 7 days)
                Trek.count({
                    where: {
                        vendor_id: vendorId,
                        status: "active",
                    },
                    include: [
                        {
                            model: Batch,
                            as: "batches",
                            where: {
                                start_date: {
                                    [Op.between]: [
                                        today,
                                        new Date(
                                            today.getTime() +
                                                7 * 24 * 60 * 60 * 1000
                                        ),
                                    ],
                                },
                            },
                            required: true,
                        },
                    ],
                }),
            ]);

        // Generate alerts
        const alerts = [];

        if (pendingBookings > 5) {
            alerts.push({
                type: "warning",
                message: `${pendingBookings} pending bookings require attention`,
                timestamp: new Date().toISOString(),
            });
        }

        if (upcomingTreks === 0) {
            alerts.push({
                type: "info",
                message: "No upcoming treks scheduled for next week",
                timestamp: new Date().toISOString(),
            });
        }

        const realTimeData = {
            today_bookings: todayBookings,
            today_revenue: roundAmount(todayRevenue || 0),
            pending_bookings: pendingBookings,
            upcoming_treks: upcomingTreks,
            alerts: alerts,
        };

        logger.info("vendor", "Real-time metrics retrieved successfully", {
            vendorId,
            todayBookings,
            todayRevenue,
            pendingBookings,
        });

        res.json({
            success: true,
            data: realTimeData,
        });
    } catch (error) {
        logger.error("vendor", "Failed to get real-time metrics", {
            error: error.message,
            stack: error.stack,
            vendorId: req.user?.id,
        });

        res.status(500).json({
            success: false,
            message: "Failed to retrieve real-time metrics",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// The functions are already exported using exports.functionName
// No need for additional module.exports
