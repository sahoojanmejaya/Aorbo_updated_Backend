const {
    Rating,
    RatingCategory,
    Trek,
    Customer,
    Booking,
    Batch,
    sequelize,
} = require("../../models");
const { Op } = require("sequelize");
const logger = require("../../utils/logger");

// Helper function to create completely isolated where clauses
const createIsolatedWhereClause = () => {
    return Object.create(null);
};

// Helper function to safely execute Sequelize queries without global contamination
const executeQuerySafely = async (queryFunction) => {
    const globalBackup = global.currentRequest;
    global.currentRequest = undefined;

    try {
        const result = await queryFunction();
        return result;
    } finally {
        global.currentRequest = globalBackup;
    }
};

const formatOneDecimal = (value) => Number(parseFloat(value || 0).toFixed(1));

// Vendor: Get reviews for vendor's treks
exports.getVendorReviews = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const { page = 1, limit = 10, trekId, status = "approved" } = req.query;
        const offset = (page - 1) * limit;

        logger.info("review", "=== VENDOR REVIEWS API CALL STARTED ===");
        logger.info("review", "Request params:", {
            vendorId,
            page,
            limit,
            trekId,
            status,
        });

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Create isolated where clause for reviews
        const reviewWhere = createIsolatedWhereClause();

        // Filter out undefined values and handle string "undefined"
        if (trekId && trekId !== "undefined" && trekId !== "all") {
            reviewWhere.trek_id = trekId;
        }

        if (status && status !== "undefined" && status !== "all") {
            reviewWhere.status = status;
        }

        logger.info(
            "review",
            "About to execute query with where clause:",
            reviewWhere
        );

        // Get ratings with associations and average rating
        const { count, rows: reviews } = await executeQuerySafely(async () => {
            return await Review.findAndCountAll({
                where: reviewWhere,
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        where: { vendor_id: vendorId },
                        attributes: ["id", "title"],
                        required: true, // This ensures only reviews for vendor's treks are returned
                    },
                    {
                        model: Customer,
                        as: "customer",
                        attributes: ["id", "name", "email"],
                    },
                    {
                        model: Booking,
                        as: "booking",
                        attributes: ["id", "booking_date"],
                    },
                ],
                attributes: {
                    include: [
                        [
                            sequelize.literal(`(
                                SELECT AVG(r.rating_value)
                                FROM ratings r
                                WHERE r.trek_id = Rating.trek_id 
                                AND r.customer_id = Rating.customer_id
                                AND r.booking_id = Rating.booking_id
                            )`),
                            "averageRating",
                        ],
                    ],
                },
                order: [["created_at", "DESC"]],
                limit: parseInt(limit),
                offset: parseInt(offset),
                logging: false,
            });
        });

        logger.info(
            "review",
            "Query completed successfully. Count:",
            count,
            "Reviews found:",
            reviews.length
        );

        res.json({
            success: true,
            reviews: reviews,
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / limit),
            totalCount: count,
        });
    } catch (error) {
        logger.error("error", "Error fetching vendor reviews:", error);
        console.error("Full error details:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch reviews",
        });
    }
};

// Vendor: Get rating analytics for vendor's treks
exports.getVendorRatingAnalytics = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const { startDate, endDate } = req.query;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        logger.info(
            "review",
            "=== VENDOR RATING ANALYTICS API CALL STARTED ==="
        );

        // Create isolated where clause for ratings
        const ratingWhere = createIsolatedWhereClause();

        if (startDate && endDate) {
            ratingWhere.created_at = {
                [Op.between]: [new Date(startDate), new Date(endDate)],
            };
        }

        // Get rating summary per trek
        logger.info(
            "review",
            "About to execute rating summary query with where clause:",
            ratingWhere
        );
        const ratingSummary = await executeQuerySafely(async () => {
            return await Rating.findAll({
                where: ratingWhere,
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        where: { vendor_id: vendorId },
                        attributes: ["id", "title"],
                        required: true, // This ensures only ratings for vendor's treks are returned
                    },
                ],
                attributes: [
                    "trek_id",
                    [
                        sequelize.fn("AVG", sequelize.col("rating_value")),
                        "averageRating",
                    ],
                    [
                        sequelize.fn("COUNT", sequelize.col("Rating.id")),
                        "totalRatings",
                    ],
                    [
                        sequelize.fn(
                            "COUNT",
                            sequelize.fn(
                                "DISTINCT",
                                sequelize.col("customer_id")
                            )
                        ),
                        "uniqueCustomers",
                    ],
                ],
                group: ["trek_id"],
                logging: false,
            });
        });

        // Get category-wise ratings (using the count fields from Rating model)
        const categoryRatings = await executeQuerySafely(async () => {
            return await Rating.findAll({
                where: ratingWhere,
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        where: { vendor_id: vendorId },
                        attributes: ["id", "title"],
                        required: true, // This ensures only ratings for vendor's treks are returned
                    },
                ],
                attributes: [
                    "trek_id",
                    [
                        sequelize.fn("AVG", sequelize.col("rating_value")),
                        "averageRating",
                    ],
                    [
                        sequelize.fn("COUNT", sequelize.col("Rating.id")),
                        "totalRatings",
                    ],
                    [
                        sequelize.fn("AVG", sequelize.col("safety_security_count")),
                        "avgSafetySecurity",
                    ],
                    [
                        sequelize.fn("AVG", sequelize.col("organizer_manner_count")),
                        "avgOrganizerManner",
                    ],
                    [
                        sequelize.fn("AVG", sequelize.col("trek_planning_count")),
                        "avgTrekPlanning",
                    ],
                    [
                        sequelize.fn("AVG", sequelize.col("women_safety_count")),
                        "avgWomenSafety",
                    ],
                ],
                group: ["trek_id"],
                logging: false,
            });
        });

        // Get recent ratings (using Rating model instead of Review)
        const recentReviews = await executeQuerySafely(async () => {
            return await Rating.findAll({
                where: ratingWhere,
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        where: { vendor_id: vendorId },
                        attributes: ["id", "title"],
                        required: true, // This ensures only ratings for vendor's treks are returned
                    },
                    {
                        model: Customer,
                        as: "customer",
                        attributes: ["id", "name", "email"],
                    },
                ],
                order: [["created_at", "DESC"]],
                limit: 10,
                logging: false,
            });
        });

        // Format the response
        const formattedRatingSummary = ratingSummary.map((item) => ({
            trekId: item.trek_id,
            trekName: item.trek?.title || item.trek?.name || "Unknown Trek",
            averageRating: formatOneDecimal(item.dataValues.averageRating),
            totalRatings: parseInt(item.dataValues.totalRatings || 0),
            uniqueCustomers: parseInt(item.dataValues.uniqueCustomers || 0),
        }));

        const formattedCategoryRatings = categoryRatings.map((item) => ({
            trekId: item.trek_id,
            trekName: item.trek?.title || item.trek?.name || "Unknown Trek",
            averageRating: formatOneDecimal(item.dataValues.averageRating),
            totalRatings: parseInt(item.dataValues.totalRatings || 0),
            categoryBreakdown: {
                safetySecurity: formatOneDecimal(item.dataValues.avgSafetySecurity),
                organizerManner: formatOneDecimal(item.dataValues.avgOrganizerManner),
                trekPlanning: formatOneDecimal(item.dataValues.avgTrekPlanning),
                womenSafety: formatOneDecimal(item.dataValues.avgWomenSafety),
            },
        }));

        const formattedRecentReviews = recentReviews.map((review) => ({
            id: review.id,
            trekId: review.trek_id,
            trekName: review.trek?.title || review.trek?.name || "Unknown Trek",
            customerName: review.customer?.name || "Anonymous",
            customerEmail: review.customer?.email,
            title: review.title,
            content: review.content,
            status: review.status,
            isVerified: review.is_verified,
            isHelpful: review.is_helpful,
            createdAt: review.created_at,
        }));

        // 30-day trend (current calendar month vs previous month)
        // Use MySQL DATE_FORMAT to filter by year-month, avoiding timezone issues
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-12
        const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        
        // Format: YYYY-MM for MySQL DATE_FORMAT
        const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        const previousMonthStr = `${previousYear}-${String(previousMonth).padStart(2, '0')}`;

        const [currentMonthAgg, previousMonthAgg] = await Promise.all([
            Rating.findOne({
                attributes: [
                    [sequelize.fn("AVG", sequelize.col("Rating.rating_value")), "avg"],
                    [sequelize.fn("COUNT", sequelize.col("Rating.id")), "count"],
                ],
                where: sequelize.where(
                    sequelize.fn("DATE_FORMAT", sequelize.col("Rating.created_at"), "%Y-%m"),
                    currentMonthStr
                ),
                include: [{ 
                    model: Trek, 
                    as: "trek", 
                    where: { vendor_id: vendorId }, 
                    attributes: [],
                    required: true 
                }],
                raw: true,
            }),
            Rating.findOne({
                attributes: [
                    [sequelize.fn("AVG", sequelize.col("Rating.rating_value")), "avg"],
                    [sequelize.fn("COUNT", sequelize.col("Rating.id")), "count"],
                ],
                where: sequelize.where(
                    sequelize.fn("DATE_FORMAT", sequelize.col("Rating.created_at"), "%Y-%m"),
                    previousMonthStr
                ),
                include: [{ 
                    model: Trek, 
                    as: "trek", 
                    where: { vendor_id: vendorId }, 
                    attributes: [],
                    required: true 
                }],
                raw: true,
            }),
        ]);

        const currentAvg = parseFloat(currentMonthAgg?.avg || 0);
        const previousAvg = parseFloat(previousMonthAgg?.avg || 0);
        const currentCount = parseInt(currentMonthAgg?.count || 0, 10);
        const previousCount = parseInt(previousMonthAgg?.count || 0, 10);
        const currentPct = currentAvg > 0 ? (currentAvg / 5) * 100 : 0;
        const previousPct = previousAvg > 0 ? (previousAvg / 5) * 100 : 0;
        const deltaPct = currentPct - previousPct; // difference in normalized %
        const avgDelta = currentAvg - previousAvg; // raw average change
        const reviewsChangePct = previousCount > 0
            ? ((currentCount - previousCount) / previousCount) * 100
            : (currentCount > 0 ? 100 : 0);
        const trend30d = {
            currentMonthAverage: Number(currentAvg.toFixed(2)),
            previousMonthAverage: Number(previousAvg.toFixed(2)),
            currentPercentage: Number(currentPct.toFixed(1)),
            previousPercentage: Number(previousPct.toFixed(1)),
            deltaPercentage: Number(deltaPct.toFixed(1)),
            averageDelta: Number(avgDelta.toFixed(2)),
            previousCount,
            currentCount,
            reviewsChangePercentage: Number(reviewsChangePct.toFixed(2)),
            direction: deltaPct >= 0 ? "positive" : "negative",
        };

        logger.info("review", "Analytics results:", {
            ratingSummaryCount: formattedRatingSummary.length,
            categoryRatingsCount: formattedCategoryRatings.length,
            recentReviewsCount: formattedRecentReviews.length,
        });

        res.json({
            success: true,
            data: {
                ratingSummary: formattedRatingSummary,
                categoryRatings: formattedCategoryRatings,
                recentReviews: formattedRecentReviews,
                trend30d,
            },
        });
    } catch (error) {
        logger.error(
            "review",
            "Error fetching vendor rating analytics:",
            error
        );
        console.error("Full analytics error details:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch rating analytics",
        });
    }
};

// Vendor: Get review by ID
exports.getReviewById = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        const reviewWhere = createIsolatedWhereClause();
        reviewWhere.id = id;

        const review = await executeQuerySafely(async () => {
            return await Rating.findOne({
                where: reviewWhere,
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
                        attributes: ["id", "name", "email", "phone"],
                    },
                    {
                        model: Booking,
                        as: "booking",
                        attributes: ["id", "booking_date", "status"],
                    },
                ],
                logging: false,
            });
        });

        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Review not found",
            });
        }

        res.json({
            success: true,
            data: review,
        });
    } catch (error) {
        logger.error("review", "Error fetching review by ID:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch review",
        });
    }
};

// Vendor: Update review status
exports.updateReviewStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const vendorId = req.user.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        const updateWhere = createIsolatedWhereClause();
        updateWhere.id = id;

        const review = await executeQuerySafely(async () => {
            return await Rating.findOne({
                where: updateWhere,
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        where: { vendor_id: vendorId },
                    },
                ],
                logging: false,
            });
        });

        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Review not found",
            });
        }

        await review.update({ status });

        res.json({
            success: true,
            message: "Review status updated successfully",
            review: review,
        });
    } catch (error) {
        logger.error("review", "Error updating review status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update review status",
        });
    }
};

// Vendor: Get rating categories
exports.getRatingCategories = async (req, res) => {
    try {
        const categories = await executeQuerySafely(async () => {
            return await RatingCategory.findAll({
                where: { is_active: true },
                order: [["sort_order", "ASC"]],
                logging: false,
            });
        });

        res.json({
            success: true,
            data: categories,
        });
    } catch (error) {
        logger.error("review", "Error fetching rating categories:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch rating categories",
        });
    }
};

// Vendor: Get ratings for vendor's treks (for dynamic table)
exports.getVendorRatings = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const { page = 1, limit = 10, search, status = "all", trekId = "all" } = req.query;
        const offset = (page - 1) * limit;

        logger.info("review", "=== VENDOR RATINGS API CALL STARTED ===");
        logger.info("review", "Request params:", {
            vendorId,
            page,
            limit,
            search,
            status,
            trekId,
        });

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Create isolated where clause for ratings
        const ratingWhere = createIsolatedWhereClause();

        // Filter by status
        if (status && status !== "all" && status !== "undefined") {
            ratingWhere.status = status;
        }

        // Filter by trek_id
        if (trekId && trekId !== "all" && trekId !== "undefined") {
            ratingWhere.trek_id = trekId;
        }

        // Search functionality
        if (search && search.trim()) {
            ratingWhere[Op.or] = [
                { content: { [Op.like]: `%${search}%` } },
                { '$customer.name$': { [Op.like]: `%${search}%` } },
                { '$trek.title$': { [Op.like]: `%${search}%` } }
            ];
        }

        logger.info("review", "About to execute ratings query with where clause:", ratingWhere);

        // Get ratings with all necessary associations
        const { count, rows: ratings } = await executeQuerySafely(async () => {
            return await Rating.findAndCountAll({
                where: ratingWhere,
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        where: { vendor_id: vendorId },
                        attributes: ["id", "title", "vendor_id"],
                        required: true, // This ensures only ratings for vendor's treks are returned
                    },
                    {
                        model: Customer,
                        as: "customer",
                        attributes: ["id", "name", "email", "phone"],
                    },
                    {
                        model: Booking,
                        as: "booking",
                        attributes: ["id", "total_travelers", "booking_date"],
                    },
                    {
                        model: Batch,
                        as: "batch",
                        attributes: ["id", "tbr_id"],
                    },
                ],
                attributes: [
                    "id",
                    "trek_id",
                    "customer_id",
                    "booking_id",
                    "batch_id",
                    "rating_value",
                    "content",
                    "status",
                    "is_verified",
                    "is_approved",
                    "is_helpful",
                    "safety_security_rated",
                    "organizer_manner_rated",
                    "trek_planning_rated",
                    "women_safety_rated",
                    "report",
                    "created_at",
                    "updated_at"
                ],
                order: [["created_at", "DESC"]],
                limit: parseInt(limit),
                offset: parseInt(offset),
                logging: false,
            });
        });

        logger.info("review", "Query completed successfully. Count:", count, "Ratings found:", ratings.length);

        // Format the response for the table
        const formattedRatings = ratings.map(rating => {
            const ratingData = rating.toJSON();
            return {
                id: `REV-${ratingData.id}`,
                booking: ratingData.booking ? `BOOK-${ratingData.booking.id}` : "N/A",
                trek: {
                    id: ratingData.trek?.id,
                    title: ratingData.trek?.title || "Unknown Trek"
                },
                customer: {
                    id: ratingData.customer?.id,
                    name: ratingData.customer?.name || "Anonymous"
                },
                created_at: ratingData.created_at,
                rating_value: parseFloat(ratingData.rating_value),
                content: ratingData.content || "",
                status: "OK", // Always "OK" as per requirements
                flagged: ratingData.report || false,
                // Category endorsements for Place endorsements section
                category_endorsements: {
                    safety: ratingData.safety_security_rated,
                    organizer: ratingData.organizer_manner_rated,
                    planning: ratingData.trek_planning_rated,
                    women_safety: ratingData.women_safety_rated
                },
                // Additional data for Place Rating column
                total_traveller: ratingData.booking?.total_travelers || 1,
                // Additional data for Place endorsements
                safety_security_rated: ratingData.safety_security_rated,
                organizer_manner_rated: ratingData.organizer_manner_rated,
                trek_planning_rated: ratingData.trek_planning_rated,
                women_safety_rated: ratingData.women_safety_rated
            };
        });

        res.json({
            success: true,
            reviews: formattedRatings,
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / limit),
            totalCount: count,
        });
    } catch (error) {
        logger.error("review", "Error fetching vendor ratings:", error);
        console.error("Full error details:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch ratings",
        });
    }
};

// Vendor: Get all ratings without pagination (for review and feedback page)
exports.getVendorRatingsUnlimited = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const { search, status = "all", trekId = "all" } = req.query;

        logger.info("review", "=== VENDOR RATINGS UNLIMITED API CALL STARTED ===");
        logger.info("review", "Request params:", {
            vendorId,
            search,
            status,
            trekId,
        });

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Create isolated where clause for ratings
        const ratingWhere = createIsolatedWhereClause();

        // Filter by status
        if (status && status !== "all" && status !== "undefined") {
            ratingWhere.status = status;
        }

        // Filter by trek_id
        if (trekId && trekId !== "all" && trekId !== "undefined") {
            ratingWhere.trek_id = trekId;
        }

        // Search functionality
        if (search && search.trim()) {
            ratingWhere[Op.or] = [
                { content: { [Op.like]: `%${search}%` } },
                { '$customer.name$': { [Op.like]: `%${search}%` } },
                { '$trek.title$': { [Op.like]: `%${search}%` } }
            ];
        }

        logger.info("review", "About to execute unlimited ratings query with where clause:", ratingWhere);

        // Get all ratings without pagination
        const ratings = await executeQuerySafely(async () => {
            return await Rating.findAll({
                where: ratingWhere,
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        where: { vendor_id: vendorId },
                        attributes: ["id", "title", "vendor_id"],
                        required: true, // This ensures only ratings for vendor's treks are returned
                    },
                    {
                        model: Customer,
                        as: "customer",
                        attributes: ["id", "name", "email", "phone"],
                    },
                    {
                        model: Booking,
                        as: "booking",
                        attributes: ["id", "total_travelers", "booking_date"],
                        required: false, // LEFT JOIN to include ratings even without booking
                    },
                    {
                        model: Batch,
                        as: "batch",
                        attributes: ["id", "tbr_id"],
                    },
                ],
                attributes: [
                    "id",
                    "trek_id",
                    "customer_id",
                    "booking_id",
                    "batch_id",
                    "rating_value",
                    "content",
                    "status",
                    "is_verified",
                    "is_approved",
                    "is_helpful",
                    "safety_security_rated",
                    "organizer_manner_rated",
                    "trek_planning_rated",
                    "women_safety_rated",
                    "report",
                    "created_at",
                    "updated_at"
                ],
                order: [["created_at", "DESC"]],
                logging: false,
            });
        });

        logger.info("review", "Unlimited query completed successfully. Total ratings found:", ratings.length);
        
        // Debug: Log first few ratings to check booking data
        if (ratings.length > 0) {
            logger.info("review", "Sample rating data:", JSON.stringify(ratings[0].toJSON(), null, 2));
        }

        // Format the response for the table
        const formattedRatings = await Promise.all(ratings.map(async (rating) => {
            const ratingData = rating.toJSON();
            
            // If no direct booking association, try to find booking by trek_id and customer_id
            let totalTravelers = ratingData.booking?.total_travelers || 1;
            let bookingId = ratingData.booking?.id;
            
            if (!ratingData.booking && ratingData.trek_id && ratingData.customer_id) {
                try {
                    const fallbackBooking = await Booking.findOne({
                        where: {
                            trek_id: ratingData.trek_id,
                            customer_id: ratingData.customer_id,
                            vendor_id: vendorId
                        },
                        attributes: ['id', 'total_travelers'],
                        order: [['created_at', 'DESC']] // Get the most recent booking
                    });
                    
                    if (fallbackBooking) {
                        totalTravelers = fallbackBooking.total_travelers;
                        bookingId = fallbackBooking.id;
                        logger.info("review", `Found fallback booking for rating ${ratingData.id}: booking ${bookingId} with ${totalTravelers} travelers`);
                    }
                } catch (error) {
                    logger.error("review", `Error finding fallback booking for rating ${ratingData.id}:`, error);
                }
            }
            
            return {
                id: `REV-${ratingData.id}`,
                booking: bookingId ? `BOOK-${bookingId}` : "N/A",
                trek: {
                    id: ratingData.trek?.id,
                    title: ratingData.trek?.title || "Unknown Trek"
                },
                customer: {
                    id: ratingData.customer?.id,
                    name: ratingData.customer?.name || "Anonymous"
                },
                created_at: ratingData.created_at,
                rating_value: formatOneDecimal(ratingData.rating_value),
                content: ratingData.content || "",
                status: "OK", // Always "OK" as per requirements
                flagged: ratingData.report || false,
                // Category endorsements for Place endorsements section
                category_endorsements: {
                    safety: ratingData.safety_security_rated,
                    organizer: ratingData.organizer_manner_rated,
                    planning: ratingData.trek_planning_rated,
                    women_safety: ratingData.women_safety_rated
                },
                // Additional data for Place Rating column
                total_traveller: totalTravelers,
                // Debug information
                booking_debug: {
                    booking_id: ratingData.booking_id,
                    booking_exists: !!ratingData.booking,
                    total_travelers: ratingData.booking?.total_travelers,
                    fallback_used: !ratingData.booking && totalTravelers > 1
                },
                // Additional data for Place endorsements
                safety_security_rated: ratingData.safety_security_rated,
                organizer_manner_rated: ratingData.organizer_manner_rated,
                trek_planning_rated: ratingData.trek_planning_rated,
                women_safety_rated: ratingData.women_safety_rated
            };
        }));

        res.json({
            success: true,
            reviews: formattedRatings,
            totalCount: formattedRatings.length,
        });
    } catch (error) {
        logger.error("review", "Error fetching unlimited vendor ratings:", error);
        console.error("Full error details:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch unlimited vendor ratings",
        });
    }
};

// Vendor: Report rating to admin
exports.reportRating = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Find the rating and verify it belongs to vendor's trek
        const rating = await executeQuerySafely(async () => {
            return await Rating.findOne({
                where: { id: id },
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        where: { vendor_id: vendorId },
                        attributes: ["id", "vendor_id"],
                        required: true,
                    },
                ],
                logging: false,
            });
        });

        if (!rating) {
            return res.status(404).json({
                success: false,
                message: "Rating not found or you don't have permission to report it",
            });
        }

        // Update the report status
        await rating.update({ report: true });

        logger.info("review", `Rating ${id} reported by vendor ${vendorId}`);

        res.json({
            success: true,
            message: "Rating reported to admin successfully",
        });
    } catch (error) {
        logger.error("review", "Error reporting rating:", error);
        res.status(500).json({
            success: false,
            message: "Failed to report rating",
        });
    }
};
