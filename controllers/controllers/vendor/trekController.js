const {
    Trek,
    Vendor,
    User,
    TrekCaptain,
    ItineraryItem,
    Accommodation,
    TrekImage,
    TrekStage,
    Batch,
    Destination,
    Review,
    Rating,
    Customer,
    Activity,
    Booking,
    BookingTraveler,
    Traveler,
    PaymentLog,
    City,
    BatchCancellationRequest,
    Cancellation,
    CancellationBooking,
} = require("../../models");
const { validationResult } = require("express-validator");
const { saveBase64Image, deleteImage } = require("../../utils/fileUpload");
const { Op } = require("sequelize");
const { roundAmount } = require("../../utils/amountUtils");
const logger = require("../../utils/logger");
const sequelize = require("../../models/index"); // Added sequelize import

// Helper function to format date time
const formatDateTime = (time, ampm) => {
    if (!time) return "";
    return `${time} ${ampm || "AM"}`;
};

// Helper function to parse JSON strings or return arrays
const parseJsonField = (field) => {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    if (typeof field === "string") {
        try {
            const parsed = JSON.parse(field);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }
    return [];
};

// Helper function to validate activity IDs
const validateActivityIds = async (activityIds) => {
    if (!activityIds || !Array.isArray(activityIds)) return true;

    const validIds = activityIds.filter((id) => Number.isInteger(id) && id > 0);
    if (validIds.length !== activityIds.length) {
        return false;
    }

    const activities = await Activity.findAll({
        where: { id: validIds, is_active: true },
    });

    return activities.length === validIds.length;
};

// Helper function to check for duplicate treks (same vendor, destination, and date)
const checkDuplicateTrek = async (
    vendorId,
    destinationId,
    batchDates,
    excludeTrekId = null
) => {
    try {
        if (
            !vendorId ||
            !destinationId ||
            !batchDates ||
            !Array.isArray(batchDates)
        ) {
            return { hasDuplicate: false, duplicateInfo: null };
        }

        // Build where clause to exclude current trek if updating
        const whereClause = {
            vendor_id: vendorId,
            destination_id: destinationId,
            status: "active",
        };

        if (excludeTrekId) {
            whereClause.id = { [Op.ne]: excludeTrekId };
        }

        // Get all active treks for this vendor and destination
        const existingTreks = await Trek.findAll({
            where: whereClause,
            include: [
                {
                    model: Batch,
                    as: "batches",
                    attributes: ["start_date", "end_date"],
                },
            ],
        });

        // Check if any existing trek has the same start date
        for (const existingTrek of existingTreks) {
            if (existingTrek.batches && existingTrek.batches.length > 0) {
                for (const existingBatch of existingTrek.batches) {
                    for (const newBatchDate of batchDates) {
                        // Check if start dates are the same
                        if (
                            existingBatch.start_date === newBatchDate.start_date
                        ) {
                            return {
                                hasDuplicate: true,
                                duplicateInfo: {
                                    trekId: existingTrek.id,
                                    trekTitle: existingTrek.title,
                                    existingStartDate: existingBatch.start_date,
                                    existingEndDate: existingBatch.end_date,
                                    newStartDate: newBatchDate.start_date,
                                    newEndDate: newBatchDate.end_date,
                                },
                            };
                        }
                    }
                }
            }
        }

        return { hasDuplicate: false, duplicateInfo: null };
    } catch (error) {
        logger.trek("error", "Error checking for duplicate treks", {
            vendorId,
            destinationId,
            error: error.message,
            stack: error.stack,
        });
        // If there's an error checking duplicates, allow the creation to proceed
        // but log the error for investigation
        return { hasDuplicate: false, duplicateInfo: null };
    }
};

// Helper function to calculate trek's overall rating from ratings
const calculateTrekRating = async (trekId) => {
    try {
        if (!trekId) {
            return {
                overall: 0.0,
                categories: {
                    "Safety and Security": 0.0,
                    "Organizer Manner": 0.0,
                    "Trek Planning": 0.0,
                    "Women Safety": 0.0,
                },
                ratingCount: 0,
            };
        }

        const ratings = await Rating.findAll({
            where: {
                trek_id: trekId,
            },
            limit: 1000, // Add limit to prevent memory issues
        });

        if (ratings.length === 0) {
            return {
                overall: 0.0,
                categories: {
                    "Safety and Security": 0.0,
                    "Organizer Manner": 0.0,
                    "Trek Planning": 0.0,
                    "Women Safety": 0.0,
                },
                ratingCount: 0,
            };
        }

        const categoryRatings = {};
        const categoryCounts = {};

        // Initialize category ratings with default values
        categoryRatings["Safety and Security"] = 0.0;
        categoryRatings["Organizer Manner"] = 0.0;
        categoryRatings["Trek Planning"] = 0.0;
        categoryRatings["Women Safety"] = 0.0;
        categoryCounts["Safety and Security"] = 0;
        categoryCounts["Organizer Manner"] = 0;
        categoryCounts["Trek Planning"] = 0;
        categoryCounts["Women Safety"] = 0;

        // Calculate category averages with error handling
        ratings.forEach((rating) => {
            try {
                const ratingValue = parseFloat(rating.rating_value) || 0;

                // Check which categories this rating applies to based on boolean flags
                if (rating.safety_security_rated) {
                    categoryRatings["Safety and Security"] += ratingValue;
                    categoryCounts["Safety and Security"]++;
                }
                if (rating.organizer_manner_rated) {
                    categoryRatings["Organizer Manner"] += ratingValue;
                    categoryCounts["Organizer Manner"]++;
                }
                if (rating.trek_planning_rated) {
                    categoryRatings["Trek Planning"] += ratingValue;
                    categoryCounts["Trek Planning"]++;
                }
                if (rating.women_safety_rated) {
                    categoryRatings["Women Safety"] += ratingValue;
                    categoryCounts["Women Safety"]++;
                }

                // If no specific categories are marked, count as overall rating
                if (!rating.safety_security_rated && !rating.organizer_manner_rated && 
                    !rating.trek_planning_rated && !rating.women_safety_rated) {
                    // For overall rating, distribute across all categories
                    categoryRatings["Safety and Security"] += ratingValue;
                    categoryCounts["Safety and Security"]++;
                    categoryRatings["Organizer Manner"] += ratingValue;
                    categoryCounts["Organizer Manner"]++;
                    categoryRatings["Trek Planning"] += ratingValue;
                    categoryCounts["Trek Planning"]++;
                    categoryRatings["Women Safety"] += ratingValue;
                    categoryCounts["Women Safety"]++;
                }
            } catch (ratingError) {
                logger.trek("warn", "Error processing rating", {
                    trekId,
                    ratingId: rating.id,
                    error: ratingError.message,
                });
            }
        });

        // Calculate averages and ensure float format with 2 decimal places
        Object.keys(categoryRatings).forEach((category) => {
            if (categoryCounts[category] > 0) {
                const average =
                    categoryRatings[category] / categoryCounts[category];
                categoryRatings[category] = parseFloat(average.toFixed(2));
            } else {
                categoryRatings[category] = 0.0;
            }
        });

        // Calculate overall average
        const validCategories = Object.keys(categoryRatings).filter(
            (category) => categoryCounts[category] > 0
        );

        let overall = 0.0;
        if (validCategories.length > 0) {
            const overallSum = validCategories.reduce(
                (sum, category) => sum + categoryRatings[category],
                0
            );
            overall = parseFloat(
                (overallSum / validCategories.length).toFixed(2)
            );
        }

        return {
            overall,
            categories: categoryRatings,
            ratingCount: ratings.length,
        };
    } catch (error) {
        logger.trek("error", "Error calculating trek rating", {
            trekId,
            error: error.message,
            stack: error.stack,
        });
        return {
            overall: 0.0,
            categories: {
                "Safety and Security": 0.0,
                "Organizer Manner": 0.0,
                "Trek Planning": 0.0,
                "Women Safety": 0.0,
            },
            ratingCount: 0,
        };
    }
};

// Helper function to ensure proper JSON array storage
const ensureJsonArray = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === "string") {
        try {
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }
    return [];
};

// Helper function to generate discount text
const generateDiscountText = (hasDiscount, discountValue, discountType) => {
    if (!hasDiscount || !discountValue || discountValue <= 0) {
        return null;
    }

    if (discountType === "percentage") {
        return `${Math.round(discountValue)}% OFF`;
    } else if (discountType === "fixed") {
        return `₹${Math.round(discountValue)} OFF`;
    }

    return null;
};

// Vendor: Get all treks for a vendor
exports.getVendorTreks = async (req, res) => {
    try {
        const vendorId = req.user?.id;

        logger.trek("info", "Fetching vendor treks", {
            vendorId,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
        });

        if (!vendorId) {
            logger.trek("warn", "Access denied - no vendor ID", {
                ip: req.ip,
                userAgent: req.get("User-Agent"),
            });
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Simplified query with fewer includes to prevent timeout
        const treks = await Trek.findAll({
            where: { vendor_id: vendorId },
            include: [
                {
                    model: Destination,
                    as: "destinationData",
                    required: false,
                    attributes: ["id", "name"],
                },
                // State association removed as state_id field was removed
                {
                    model: TrekCaptain,
                    as: "captain",
                    required: false,
                    attributes: ["id", "name", "email", "phone", "status"],
                },
                {
                    model: TrekImage,
                    as: "images",
                    required: false,
                    attributes: ["id", "url", "is_cover"],
                },
                {
                    model: Accommodation,
                    as: "accommodations",
                    required: false,
                    attributes: ["id", "type", "details"],
                },
                {
                    model: Batch,
                    as: "batches",
                    required: false,
                    attributes: [
                        "id",
                        "tbr_id",
                        "start_date",
                        "end_date",
                        "capacity",
                        "booked_slots",
                        "available_slots",
                    ],
                },
            ],
            order: [["created_at", "DESC"]],
            limit: 50, // Add limit to prevent memory issues
        });

        logger.trek(
            "info",
            `Found ${treks.length} treks for vendor ${vendorId}`
        );

        // Process treks with better error handling
        const treksWithRatings = await Promise.allSettled(
            treks.map(async (trek) => {
                try {
                    // Simplified rating calculation
                    const trekRating = await calculateTrekRating(trek.id).catch(
                        () => ({
                            overall: 0,
                            categories: {},
                            ratingCount: 0,
                        })
                    );

                    // Fetch activity details with error handling
                    let activityDetails = [];
                    try {
                        if (
                            trek.activities &&
                            Array.isArray(trek.activities) &&
                            trek.activities.length > 0
                        ) {
                            activityDetails = await Activity.findAll({
                                where: { id: trek.activities, is_active: true },
                                attributes: ["id", "name", "category_name"],
                                limit: 20, // Limit activities
                            });
                        }
                    } catch (activityError) {
                        logger.trek("warn", "Error fetching activity details", {
                            trekId: trek.id,
                            error: activityError.message,
                        });
                    }

                    // Fetch city details with error handling
                    let cityDetails = [];
                    try {
                        if (
                            trek.city_ids &&
                            Array.isArray(trek.city_ids) &&
                            trek.city_ids.length > 0
                        ) {
                            cityDetails = await City.findAll({
                                where: { id: trek.city_ids },
                                // State association removed as state_id field was removed
                                attributes: ["id", "cityName", "isPopular"],
                                limit: 10, // Limit cities
                            });
                        }
                    } catch (cityError) {
                        logger.trek("warn", "Error fetching city details", {
                            trekId: trek.id,
                            error: cityError.message,
                        });
                    }

                    return {
                        ...trek.toJSON(),
                        rating: trekRating.overall || 0,
                        ratingCount: trekRating.ratingCount || 0,
                        categoryRatings: trekRating.categories || {},
                        activityDetails: activityDetails,
                        cityDetails: cityDetails,
                    };
                } catch (trekError) {
                    logger.trek("error", "Error processing trek", {
                        trekId: trek.id,
                        error: trekError.message,
                        stack: trekError.stack,
                    });

                    // Return basic trek data if processing fails
                    return {
                        ...trek.toJSON(),
                        rating: 0,
                        ratingCount: 0,
                        categoryRatings: {},
                        activityDetails: [],
                        cityDetails: [],
                        error: "Failed to load complete data",
                    };
                }
            })
        );

        // Filter out failed promises and get successful results
        const successfulTreks = treksWithRatings
            .filter((result) => result.status === "fulfilled")
            .map((result) => result.value);

        const failedCount = treksWithRatings.filter(
            (result) => result.status === "rejected"
        ).length;

        if (failedCount > 0) {
            logger.trek(
                "warn",
                `${failedCount} treks failed to process completely`
            );
        }

        logger.trek(
            "info",
            `Successfully processed ${successfulTreks.length} treks`
        );

        res.json({
            success: true,
            data: successfulTreks,
            totalProcessed: successfulTreks.length,
            totalFailed: failedCount,
        });
    } catch (error) {
        logger.trek("error", "Error fetching vendor treks", {
            vendorId: req.user?.id,
            error: error.message,
            stack: error.stack,
            ip: req.ip,
        });

        res.status(500).json({
            success: false,
            message: "Failed to fetch treks",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Vendor: Get trek by ID
exports.getTrekById = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // First, fetch the basic trek data with minimal includes
        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
            include: [
                {
                    model: Destination,
                    as: "destinationData",
                    required: false,
                    attributes: ["id", "name", "state", "isPopular", "status"]
                },
                {
                    model: TrekCaptain,
                    as: "captain",
                    required: false,
                    attributes: ["id", "name", "email", "phone", "status"]
                }
            ],
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        // Fetch related data in parallel for better performance
        const [
            trekRating,
            activityDetails,
            cityDetails,
            itineraryItems,
            accommodations,
            images,
            trekStages
        ] = await Promise.all([
            // Calculate rating
            calculateTrekRating(trek.id),

            // Fetch activity details if activity IDs exist
            trek.activities && Array.isArray(trek.activities) && trek.activities.length > 0
                ? Activity.findAll({
                    where: { id: trek.activities, is_active: true },
                    attributes: ["id", "name", "category_name"],
                })
                : [],

            // Fetch city details if city_ids exist
            trek.city_ids && Array.isArray(trek.city_ids) && trek.city_ids.length > 0
                ? City.findAll({
                    where: { id: trek.city_ids },
                    attributes: ["id", "cityName", "isPopular"],
                })
                : [],

            // Fetch itinerary items
            ItineraryItem.findAll({
                where: { trek_id: trek.id },
                attributes: ["id", "trek_id", "activities", "createdAt", "updatedAt"]
            }),

            // Fetch accommodations
            Accommodation.findAll({
                where: { trek_id: trek.id },
                attributes: ["id", "trek_id", "batch_id", "type", "details", "createdAt", "updatedAt"]
            }),

            // Fetch images
            TrekImage.findAll({
                where: { trek_id: trek.id },
                attributes: ["id", "trek_id", "url", "is_cover", "createdAt", "updatedAt"]
            }),

            // Fetch trek stages with cities
            TrekStage.findAll({
                where: { trek_id: trek.id },
                include: [
                    {
                        model: City,
                        as: "city",
                        required: false,
                        attributes: ["id", "cityName"],
                    },
                ],
                attributes: ["id", "trek_id", "batch_id", "stage_name", "destination", "means_of_transport", "date_time", "is_boarding_point", "city_id", "createdAt", "updatedAt"]
            })
        ]);

        const trekData = {
            ...trek.toJSON(),
            base_price: roundAmount(trek.base_price || 0),
            rating: trekRating.overall,
            ratingCount: trekRating.ratingCount,
            categoryRatings: trekRating.categories,
            activityDetails: activityDetails,
            cityDetails: cityDetails,
            itinerary_items: itineraryItems,
            accommodations: accommodations,
            images: images,
            trek_stages: trekStages
        };

        res.json({
            success: true,
            data: trekData,
        });
    } catch (error) {
        console.error("Error fetching trek by ID:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch trek",
        });
    }
};

// Vendor: Create trek with all related data
exports.createTrek = async (req, res) => {
    const startTime = Date.now();
    const requestId =
        req.headers["x-request-id"] || `create-trek-${Date.now()}`;
    
    const transaction = await sequelize.sequelize.transaction();

    try {
        const vendorId = req.user?.id;

        logger.trek("info", "Create trek request started", {
            requestId,
            vendorId,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            trekData: {
                title: req.body.title,
                destination_id: req.body.destination_id,
                duration_days: req.body.duration_days,
                base_price: req.body.base_price,
                max_participants: req.body.max_participants,
                has_discount: req.body.has_discount,
                status: req.body.status,
                city_ids: req.body.city_ids?.length || 0,
                activities: req.body.activities?.length || 0,
                inclusions: req.body.inclusions?.length || 0,
                exclusions: req.body.exclusions?.length || 0,
                hasRelatedData: !!(req.body.trekStages || req.body.accommodations || req.body.itinerary || req.body.media || req.body.selectedServiceDays),
            },
        });

        if (!vendorId) {
            await transaction.rollback();
            logger.trek("warn", "Create trek access denied - no vendor ID", {
                requestId,
                vendorId,
                ip: req.ip,
                userAgent: req.get("User-Agent"),
            });
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Validate destination exists
        if (req.body.destination_id) {
            const destination = await Destination.findByPk(
                req.body.destination_id
            );
            if (!destination) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "Selected destination does not exist",
                    errors: {
                        destination_id: ["Selected destination does not exist"],
                    },
                });
            }
        }

        // Validate cities exist if provided
        if (req.body.city_ids && Array.isArray(req.body.city_ids)) {
            for (const cityId of req.body.city_ids) {
                const city = await City.findByPk(cityId);
                if (!city) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `City with ID ${cityId} does not exist`,
                        errors: {
                            city_ids: [`City with ID ${cityId} does not exist`],
                        },
                    });
                }
            }
        }

        // Validate activity IDs if provided
        if (req.body.activities) {
            const areValidActivities = await validateActivityIds(
                req.body.activities
            );
            if (!areValidActivities) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "One or more activity IDs are invalid or inactive",
                    errors: {
                        activities: [
                            "One or more activity IDs are invalid or inactive",
                        ],
                    },
                });
            }
        }

        // Validate captain exists if provided
        if (req.body.captain_id) {
            const captain = await TrekCaptain.findOne({
                where: {
                    id: req.body.captain_id,
                    vendor_id: vendorId,
                    status: "active",
                },
            });
            if (!captain) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "Selected captain does not exist or is not active",
                    errors: {
                        captain_id: [
                            "Selected captain does not exist or is not active",
                        ],
                    },
                });
            }
        }


        // Generate MTR ID for main trek (max 10 characters: MTR + 2-digit timestamp + 5 random chars)
        const generateMtrId = () => {
            const timestamp = Date.now().toString().slice(-2);
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            let random = "";
            for (let i = 0; i < 5; i++) {
                random += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return `MTR${timestamp}${random}`;
        };

        // Prepare main trek data
        const trekData = {
            ...req.body,
            vendor_id: vendorId,
            mtr_id: generateMtrId(),
        };

        // Remove related data from main trek payload  
        delete trekData.trekStages;
        delete trekData.accommodations;
        delete trekData.itinerary;
        delete trekData.itineraryDays;
        delete trekData.media;
        delete trekData.selectedServiceDays;
        delete trekData.selectedServiceDates;
        delete trekData.autoGeneratedDates;
        delete trekData.manuallyDeselectedDates;
        delete trekData.selectedActivities;
        delete trekData.customActivities;
        delete trekData.selectedInclusions;
        delete trekData.customInclusions;
        delete trekData.customExclusions;
        delete trekData.selectedCities;
        delete trekData.selectedCitiesData;
        delete trekData.assignedCaptain;
        delete trekData.coverImage;

        // Create the main trek
        const trek = await Trek.create(trekData, { transaction });

        const relatedDataResults = {
            trekStages: [],
            accommodations: [],
            itineraryItems: [],
            trekImages: [],
            batches: [],
        };

        // Create Batches from frontend-provided batch data FIRST (trek stages need batch IDs)
        let batchIdMapping = {}; // Maps temporary batch IDs to real batch IDs
        
        if (req.body.batches && Array.isArray(req.body.batches)) {
            logger.trek("info", "Creating batches from frontend data", {
                requestId,
                trekId: trek.id,
                batchCount: req.body.batches.length,
            });

            // Generate TBR ID helper
            const generateTbrId = () => {
                const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                let result = "TBR";
                for (let i = 0; i < 7; i++) {
                    result += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                return result;
            };

            for (const batchData of req.body.batches) {
                const newBatchData = {
                    tbr_id: generateTbrId(),
                    trek_id: trek.id,
                    start_date: batchData.start_date,
                    end_date: batchData.end_date,
                    capacity: batchData.capacity || req.body.max_participants || 20,
                    booked_slots: batchData.booked_slots || 0,
                    available_slots: batchData.available_slots || batchData.capacity || req.body.max_participants || 20,
                };

                const batch = await Batch.create(newBatchData, { transaction });
                relatedDataResults.batches.push(batch);
                
                // Map temporary batch ID to real batch ID
                if (batchData.id) { // Frontend sends temporary ID
                    batchIdMapping[batchData.id] = batch.id;
                }
            }
        }

        // Auto-generate batches from selectedServiceDates if no manual batches were provided
        if ((!req.body.batches || req.body.batches.length === 0) &&
            req.body.selectedServiceDates && Array.isArray(req.body.selectedServiceDates) &&
            req.body.selectedServiceDates.length > 0) {

            logger.trek("info", "Auto-generating batches from selectedServiceDates", {
                requestId,
                trekId: trek.id,
                serviceDatesCount: req.body.selectedServiceDates.length,
                serviceDates: req.body.selectedServiceDates
            });

            // Generate TBR ID helper
            const generateTbrId = () => {
                const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                let result = "TBR";
                for (let i = 0; i < 7; i++) {
                    result += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                return result;
            };

            // Import IST date utilities
            const { formatISTDate, addDaysIST, parseISTDate } = require('../../utils/istDateUtils');

            // Helper function to calculate end date from start date and duration using IST
            const calculateEndDate = (startDate, durationDays) => {
                // Parse the start date in IST
                const startDateIST = parseISTDate(startDate);
                if (!startDateIST) {
                    logger.trek("error", "Invalid start date provided", {
                        requestId,
                        startDate,
                        durationDays
                    });
                    return startDate; // Fallback to original date
                }

                // Add duration days (duration includes start date, so subtract 1)
                const endDateIST = addDaysIST(startDateIST, durationDays - 1);

                // Return YYYY-MM-DD format in IST
                return formatISTDate(endDateIST);
            };

            for (const serviceDate of req.body.selectedServiceDates) {
                const startDate = typeof serviceDate === 'string' ? serviceDate : serviceDate.date;

                // Normalize start date to YYYY-MM-DD format using IST
                const normalizedStartDate = startDate.includes('T') ? startDate.split('T')[0] : startDate;
                const endDate = calculateEndDate(normalizedStartDate, req.body.duration_days || 1);

                logger.trek("info", "Processing service date for batch creation (IST)", {
                    requestId,
                    trekId: trek.id,
                    originalServiceDate: serviceDate,
                    normalizedStartDate,
                    endDate,
                    durationDays: req.body.duration_days,
                    timezone: 'Asia/Kolkata'
                });

                const newBatchData = {
                    tbr_id: generateTbrId(),
                    trek_id: trek.id,
                    start_date: normalizedStartDate,
                    end_date: endDate,
                    capacity: req.body.max_participants || 20,
                    booked_slots: 0,
                    available_slots: req.body.max_participants || 20,
                };

                const batch = await Batch.create(newBatchData, { transaction });
                relatedDataResults.batches.push(batch);

                logger.trek("info", "Auto-generated batch created", {
                    requestId,
                    trekId: trek.id,
                    batchId: batch.id,
                    tbrId: batch.tbr_id,
                    startDate: batch.start_date,
                    endDate: batch.end_date
                });
            }

            logger.trek("info", "Auto-batch generation completed", {
                requestId,
                trekId: trek.id,
                totalBatchesCreated: relatedDataResults.batches.length
            });
        }

        // Process Trek Stages - now batch-specific (AFTER batches are created)
        if (req.body.trekStages && Array.isArray(req.body.trekStages)) {
            logger.trek("info", "Processing trek stages with batch mapping", {
                requestId,
                trekId: trek.id,
                stageCount: req.body.trekStages.length,
                batchCount: relatedDataResults.batches.length,
                batchIdMapping
            });

            // Handle different cases for trek stage creation
            if (relatedDataResults.batches.length > 0) {
                // Check if stages have unique batch_id assignments (proper manual batches)
                const stagesWithBatchId = req.body.trekStages.filter(stage => stage.batch_id);
                const uniqueBatchIds = [...new Set(stagesWithBatchId.map(stage => stage.batch_id))];
                
                // Case 1: Stages have unique batch_id assignments (proper manual batches)
                if (stagesWithBatchId.length > 0 && uniqueBatchIds.length > 1) {
                    logger.trek("info", "Creating trek stages with manual batch assignments", {
                        requestId,
                        trekId: trek.id,
                        stageCount: req.body.trekStages.length,
                        uniqueBatchIds: uniqueBatchIds
                    });
                    
                    for (const stage of req.body.trekStages) {
                        // Map temporary batch_id to real batch_id
                        const realBatchId = batchIdMapping[stage.batch_id] || stage.batch_id;

                        const stageData = {
                            trek_id: trek.id,
                            batch_id: realBatchId, // Use mapped real batch ID
                            stage_name: stage.type || stage.stage_name || "Stage",
                            destination: stage.destination || "",
                            means_of_transport: stage.transport || stage.means_of_transport || "",
                            date_time: stage.date_time, // Full date-time from frontend
                            is_boarding_point: stage.type === "boarding" || stage.is_boarding_point === true,
                            city_id: stage.city_id || null,
                        };

                        const trekStage = await TrekStage.create(stageData, { transaction });
                        relatedDataResults.trekStages.push(trekStage);
                    }
                } else {
                    // Case 2: Stages without batch_id OR all stages have same batch_id (auto-generated batches)
                    // Create stages for each batch to ensure proper distribution
                    logger.trek("info", "Creating trek stages for auto-generated batches (distributed)", {
                        requestId,
                        trekId: trek.id,
                        stageCount: req.body.trekStages.length,
                        batchCount: relatedDataResults.batches.length,
                        reason: stagesWithBatchId.length === 0 ? "no_batch_ids" : "same_batch_ids"
                    });

                    for (const batch of relatedDataResults.batches) {
                        for (const stage of req.body.trekStages) {
                            const stageData = {
                                trek_id: trek.id,
                                batch_id: batch.id, // Use auto-generated batch ID (distributed across all batches)
                                stage_name: stage.type || stage.stage_name || "Stage",
                                destination: stage.destination || "",
                                means_of_transport: stage.transport || stage.means_of_transport || "",
                                date_time: stage.date_time, // Full date-time from frontend
                                is_boarding_point: stage.type === "boarding" || stage.is_boarding_point === true,
                                city_id: stage.city_id || null,
                            };

                            const trekStage = await TrekStage.create(stageData, { transaction });
                            relatedDataResults.trekStages.push(trekStage);
                        }
                    }

                    logger.trek("info", "Trek stages created for auto-generated batches (distributed)", {
                        requestId,
                        trekId: trek.id,
                        totalStagesCreated: relatedDataResults.trekStages.length,
                        stagesPerBatch: req.body.trekStages.length,
                        batchesUsed: relatedDataResults.batches.length
                    });
                }
            } else {
                logger.trek("warn", "No batches available for trek stage creation", {
                    requestId,
                    trekId: trek.id,
                    stageCount: req.body.trekStages.length
                });
            }
        }

        // Process Accommodations - now batch-specific (AFTER batches are created)
        if (req.body.accommodations && Array.isArray(req.body.accommodations)) {
            logger.trek("info", "Processing batch-specific accommodations", {
                requestId,
                trekId: trek.id,
                accommodationCount: req.body.accommodations.length,
                batchCount: relatedDataResults.batches.length,
            });

            // Create accommodations for each batch
            for (const batch of relatedDataResults.batches) {
                for (const accommodation of req.body.accommodations) {
                    const accommodationData = {
                        trek_id: trek.id,
                        batch_id: batch.id, // Link to specific batch
                        type: accommodation.type || "",
                        details: {
                            night: accommodation.night || 1,
                            location: accommodation.location || "",
                        },
                    };

                    const newAccommodation = await Accommodation.create(accommodationData, { transaction });
                    relatedDataResults.accommodations.push(newAccommodation);
                }
            }
            
            logger.trek("info", "Batch-specific accommodations created", {
                requestId,
                trekId: trek.id,
                totalAccommodationsCreated: relatedDataResults.accommodations.length,
                accommodationsPerBatch: req.body.accommodations.length,
            });
        }

        // Process Itinerary Items
        if (req.body.itinerary && Array.isArray(req.body.itinerary)) {
            logger.trek("info", "Processing itinerary items", {
                requestId,
                trekId: trek.id,
                itineraryCount: req.body.itinerary.length,
            });

            for (const day of req.body.itinerary) {
                const itineraryData = {
                    trek_id: trek.id,
                    activities: day.activities || [],
                };

                const itineraryItem = await ItineraryItem.create(itineraryData, { transaction });
                relatedDataResults.itineraryItems.push(itineraryItem);
            }
        }

        // Process Media/Images
        if (req.body.media && Array.isArray(req.body.media)) {
            logger.trek("info", "Processing media/images", {
                requestId,
                trekId: trek.id,
                mediaCount: req.body.media.length,
            });

            for (const media of req.body.media) {
                // Accept both preview (full data URL) or data (raw/base64)
                const raw = media.preview || media.data || "";
                if (raw && raw.length > 0) {
                    try {
                        // Normalize to data URL if prefix missing
                        const base64 = raw.startsWith("data:image")
                            ? raw
                            : `data:image/jpeg;base64,${raw}`;

                        // Save Base64 image to file system
                        const imagePath = await saveBase64Image(base64, vendorId);

                        const imageData = {
                            trek_id: trek.id,
                            url: imagePath,
                            is_cover: media.isCover || false,
                        };

                        const trekImage = await TrekImage.create(imageData, { transaction });
                        relatedDataResults.trekImages.push(trekImage);
                    } catch (imageError) {
                        logger.trek("error", "Failed to process image", {
                            requestId,
                            trekId: trek.id,
                            error: imageError.message,
                            imageIndex: req.body.media.indexOf(media),
                        });
                    }
                }
            }
        }


        await transaction.commit();

        const duration = Date.now() - startTime;
        logger.trek("info", "Trek created successfully with all related data", {
            requestId,
            trekId: trek.id,
            vendorId,
            title: trek.title,
            duration: `${duration}ms`,
            relatedDataCounts: {
                trekStages: relatedDataResults.trekStages.length,
                accommodations: relatedDataResults.accommodations.length,
                itineraryItems: relatedDataResults.itineraryItems.length,
                trekImages: relatedDataResults.trekImages.length,
                batches: relatedDataResults.batches.length,
            },
        });

        // Round base_price in response trek payload
        const responseTrek = { ...trek.toJSON(), base_price: roundAmount(trek.base_price || 0) };

        res.status(201).json({
            success: true,
            message: "Trek created successfully with all related data",
            data: {
                trek: responseTrek,
                relatedData: {
                    trekStages: relatedDataResults.trekStages,
                    accommodations: relatedDataResults.accommodations,
                    itineraryItems: relatedDataResults.itineraryItems,
                    trekImages: relatedDataResults.trekImages,
                    batches: relatedDataResults.batches,
                },
                summary: {
                    trekStagesCreated: relatedDataResults.trekStages.length,
                    accommodationsCreated: relatedDataResults.accommodations.length,
                    itineraryItemsCreated: relatedDataResults.itineraryItems.length,
                    trekImagesCreated: relatedDataResults.trekImages.length,
                    batchesCreated: relatedDataResults.batches.length,
                },
            },
        });
    } catch (error) {
        await transaction.rollback();
        
        const duration = Date.now() - startTime;
        logger.trek("error", "Failed to create trek", {
            requestId,
            vendorId: req.user?.id,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            body: req.body,
            params: req.params,
            query: req.query,
        });

        res.status(500).json({
            success: false,
            message: "Failed to create trek",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

// Vendor: Update trek
exports.updateTrek = async (req, res) => {
    const startTime = Date.now();
    const requestId =
        req.headers["x-request-id"] || `update-trek-${Date.now()}`;

    try {
        const { id } = req.params;
        const vendorId = req.user?.id;

        logger.trek("info", "Update trek request started", {
            requestId,
            trekId: id,
            vendorId,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            updateData: {
                title: req.body.title,
                destination_id: req.body.destination_id,
                duration_days: req.body.duration_days,
                base_price: req.body.base_price,
                max_participants: req.body.max_participants,
                has_discount: req.body.has_discount,
                status: req.body.status,
                city_ids: req.body.city_ids?.length || 0,
                activities: req.body.activities?.length || 0,
                inclusions: req.body.inclusions?.length || 0,
                exclusions: req.body.exclusions?.length || 0,
            },
        });

        if (!vendorId) {
            logger.trek("warn", "Update trek access denied - no vendor ID", {
                requestId,
                trekId: id,
                vendorId,
            });
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        // Check if trek has already been edited
        if (trek.has_been_edited === 1) {
            return res.status(400).json({
                success: false,
                message:
                    "This trek has already been edited and cannot be modified further",
            });
        }

        // Check 3-day departure validation by finding the earliest batch
        const earliestBatch = await Batch.findOne({
            where: { trek_id: id },
            order: [['start_date', 'ASC']],
            attributes: ['start_date']
        });

        if (earliestBatch) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const departureDate = new Date(earliestBatch.start_date);
            departureDate.setHours(0, 0, 0, 0);

            const daysDifference = Math.ceil((departureDate - today) / (1000 * 60 * 60 * 24));

            if (daysDifference < 3) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot edit trek less than 3 days before departure date",
                });
            }
        }

        // Only allow editing captain_id and accommodations
        const allowedFields = ["captain_id", "accommodations"];
        const updateData = {};

        // Check if only allowed fields are being updated
        const requestedFields = Object.keys(req.body);
        const hasUnauthorizedFields = requestedFields.some(
            (field) => !allowedFields.includes(field)
        );

        if (hasUnauthorizedFields) {
            return res.status(400).json({
                success: false,
                message:
                    "Only trek captain and accommodations can be updated. Other fields are not editable.",
                allowedFields: allowedFields,
            });
        }

        // Validate captain exists if being updated
        if (req.body.captain_id) {
            const captain = await TrekCaptain.findOne({
                where: {
                    id: req.body.captain_id,
                    vendor_id: vendorId,
                    status: "active",
                },
            });
            if (!captain) {
                return res.status(400).json({
                    success: false,
                    message: "Selected captain does not exist or is not active",
                    errors: {
                        captain_id: [
                            "Selected captain does not exist or is not active",
                        ],
                    },
                });
            }
        }

        // Set has_been_edited to 1 since this is the first edit
        updateData.captain_id = req.body.captain_id;
        updateData.has_been_edited = 1;

        await trek.update(updateData);

        // If accommodations are also being updated, handle them here
        if (req.body.accommodations && Array.isArray(req.body.accommodations)) {
            // Delete existing accommodations
            await Accommodation.destroy({
                where: { trek_id: id },
            });

            // Create new accommodations
            for (const accommodation of req.body.accommodations) {
                await Accommodation.create({
                    trek_id: id,
                    type: accommodation.type || "",
                    details: {
                        night: accommodation.night || 1,
                        location: accommodation.location || "",
                    },
                });
            }
        }

        res.json({
            success: true,
            message: "Trek updated successfully",
            data: trek,
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.trek("error", "Failed to update trek", {
            requestId,
            trekId: req.params.id,
            vendorId: req.user?.id,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            body: req.body,
            params: req.params,
            query: req.query,
        });

        res.status(500).json({
            success: false,
            message: "Failed to update trek",
        });
    }
};

// Vendor: Get batch details for editing
exports.getBatchForEdit = async (req, res) => {
    const startTime = Date.now();
    const requestId = req.headers["x-request-id"] || `get-batch-edit-${Date.now()}`;

    try {
        const { batchId } = req.params;
        const vendorId = req.user?.id;

        // Find the batch with associated data
        const batch = await Batch.findOne({
            where: { id: batchId },
            include: [
                {
                    model: Trek,
                    as: 'trek',
                    where: { vendor_id: vendorId },
                    attributes: ['id', 'vendor_id', 'has_been_edited', 'title', 'mtr_id']
                },
                {
                    model: TrekCaptain,
                    as: 'captain',
                    attributes: ['id', 'name', 'email', 'phone']
                },
                {
                    model: Accommodation,
                    as: 'accommodations',
                    attributes: ['id', 'type', 'details']
                }
            ]
        });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: "Batch not found or you don't have permission to access it",
            });
        }

        res.json({
            success: true,
            data: {
                batch_id: batch.id,
                trek: batch.trek,
                captain: batch.captain,
                accommodations: batch.accommodations,
                start_date: batch.start_date,
                end_date: batch.end_date,
                capacity: batch.capacity,
                booked_slots: batch.booked_slots,
                available_slots: batch.available_slots
            }
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.trek("error", "Failed to get batch for edit", {
            requestId,
            batchId: req.params.batchId,
            vendorId: req.user?.id,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
        });

        res.status(500).json({
            success: false,
            message: "Failed to get batch details",
        });
    }
};

// Vendor: Update batch (captain and accommodations)
exports.updateBatch = async (req, res) => {
    const startTime = Date.now();
    const requestId = req.headers["x-request-id"] || `update-batch-${Date.now()}`;

    try {
        const { batchId } = req.params;
        const vendorId = req.user?.id;

        logger.trek("info", "Update batch request started", {
            requestId,
            batchId,
            vendorId,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            body: req.body,
        });

        // Find the batch and verify vendor ownership
        const batch = await Batch.findOne({
            where: {
                id: batchId,
            },
            include: [{
                model: Trek,
                as: 'trek',
                where: { vendor_id: vendorId },
                attributes: ['id', 'vendor_id', 'has_been_edited']
            }]
        });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: "Batch not found or you don't have permission to edit it",
            });
        }

        // Check if trek has been edited before (one-time edit restriction)
        if (batch.trek.has_been_edited) {
            return res.status(400).json({
                success: false,
                message: "This trek has already been edited and cannot be modified further",
            });
        }

        // Check 3-day departure validation
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const departureDate = new Date(batch.start_date);
        departureDate.setHours(0, 0, 0, 0);

        const daysDifference = Math.ceil((departureDate - today) / (1000 * 60 * 60 * 24));

        if (daysDifference < 3) {
            return res.status(400).json({
                success: false,
                message: "Cannot edit batch less than 3 days before departure date",
            });
        }

        // Only allow editing captain_id and accommodations
        const allowedFields = ["captain_id", "accommodations"];

        // Check if only allowed fields are being updated
        const requestedFields = Object.keys(req.body);
        const hasUnauthorizedFields = requestedFields.some(
            (field) => !allowedFields.includes(field)
        );

        if (hasUnauthorizedFields) {
            return res.status(400).json({
                success: false,
                message: "Only batch captain and accommodations can be updated. Other fields are not editable.",
                allowedFields: allowedFields,
            });
        }

        // Update captain if provided
        if (req.body.captain_id !== undefined) {
            await batch.update({ captain_id: req.body.captain_id });
        }

        // Update accommodations if provided
        if (req.body.accommodations && Array.isArray(req.body.accommodations)) {
            // Delete existing accommodations for this batch
            await Accommodation.destroy({
                where: { batch_id: batchId }
            });

            // Create new accommodations for this batch
            for (const accommodation of req.body.accommodations) {
                await Accommodation.create({
                    batch_id: batchId,
                    trek_id: batch.trek.id,
                    type: accommodation.type,
                    details: {
                        night: accommodation.night || 1,
                        location: accommodation.location || "",
                    },
                });
            }
        }

        // Mark trek as edited (one-time edit flag)
        await Trek.update(
            { has_been_edited: true },
            { where: { id: batch.trek.id } }
        );

        res.json({
            success: true,
            message: "Batch updated successfully",
            data: { batch_id: batchId },
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.trek("error", "Failed to update batch", {
            requestId,
            batchId: req.params.batchId,
            vendorId: req.user?.id,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            body: req.body,
            params: req.params,
            query: req.query,
        });

        res.status(500).json({
            success: false,
            message: "Failed to update batch",
        });
    }
};

// Vendor: Get customer booking details by TBR ID
exports.getBookingDetailsByTBR = async (req, res) => {
    const startTime = Date.now();
    const requestId = req.headers["x-request-id"] || `tbr-bookings-${Date.now()}`;

    try {
        const { tbrId } = req.params;
        const vendorId = req.user?.id;

        logger.trek("info", "Get booking details by TBR request started", {
            requestId,
            tbrId,
            vendorId,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
        });

        // First, find the batch with the given TBR ID and verify vendor ownership
        const batch = await Batch.findOne({
            where: { tbr_id: tbrId },
            include: [{
                model: Trek,
                as: 'trek',
                where: { vendor_id: vendorId },
                attributes: ['id', 'title', 'vendor_id']
            }],
            attributes: ['id', 'tbr_id', 'start_date', 'end_date']
        });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: "TBR not found or you don't have permission to access it",
            });
        }

        // Get all bookings for this batch with complete customer and payment information
        const bookings = await Booking.findAll({
            where: { batch_id: batch.id },
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['id', 'name', 'email', 'phone']
                },
                {
                    model: BookingTraveler,
                    as: 'travelers',
                    include: [{
                        model: Traveler,
                        as: 'traveler',
                        attributes: ['id', 'name', 'age', 'gender']
                    }]
                },
                {
                    model: PaymentLog,
                    as: 'payments',
                    attributes: ['id', 'amount', 'payment_method', 'status', 'created_at']
                }
            ],
            attributes: [
                'id', 'customer_id', 'total_travelers', 'total_amount', 'final_amount',
                'remaining_amount', 'payment_status', 'status', 'booking_date', 'created_at'
            ],
            order: [['created_at', 'DESC']]
        });

        // Simple cancellation logic:
        // 1. Get booking IDs for this batch
        const batchBookingIds = bookings.map(b => b.id);
        
        // 2. Check cancellation_bookings table for these booking IDs
        const cancellationBookings = batchBookingIds.length > 0 ? await CancellationBooking.findAll({
            where: {
                booking_id: {
                    [Op.in]: batchBookingIds
                }
            },
            attributes: ['id', 'booking_id']
        }) : [];
        
        // 3. Also count bookings with status = 'cancelled' from bookings table
        const cancelledBookingsFromStatus = bookings.filter(b => b.status === 'cancelled');

        // Process bookings to calculate payment details and format response
        const customerBookingDetails = bookings.map(booking => {
            // Booking-level amounts from DB
            const totalTravelers = parseInt(booking.total_travelers || 0, 10);
            const totalAmountFromDb = parseFloat(booking.total_amount || 0); // Treat as Total
            const remainingFromDb = parseFloat(booking.remaining_amount || 0);

            // Calculate Paid based on payment status per business rules
            let computedPaid = 0;
            if (booking.payment_status === 'partial') {
                computedPaid = 999 * totalTravelers;
            } else if (booking.payment_status === 'full_paid') {
                // For full paid, Paid should equal Total
                computedPaid = totalAmountFromDb;
            } else {
                // Fallback: sum successful payments
                const successfulPayments = booking.payments?.filter(p => p.status === 'success') || [];
                computedPaid = successfulPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
            }

            // Remaining should come from DB for partial/pending; zero for full paid
            const computedRemaining = booking.payment_status === 'full_paid' ? 0 : remainingFromDb;

            // Get primary traveler info (first traveler or customer info)
            const primaryTraveler = booking.travelers?.[0]?.traveler;
            const customerInfo = booking.customer;

            // Show only the main customer's age/gender (first traveler)
            const ageGenderInfo = primaryTraveler
                ? `${primaryTraveler.age}/${primaryTraveler.gender.charAt(0).toUpperCase()}`
                : 'N/A';

            // Get all travelers for the travelers array
            const travelers = booking.travelers?.map(bt => bt.traveler) || [];

            return {
                bookingId: booking.id,
                customerName: primaryTraveler?.name || customerInfo?.name || 'N/A',
                ageGender: ageGenderInfo,
                contact: customerInfo?.phone || customerInfo?.email || 'N/A',
                slots: booking.total_travelers,
                paymentStatus: booking.payment_status,
                bookingStatus: booking.status,
                totalAmount: roundAmount(totalAmountFromDb),
                paidAmount: roundAmount(computedPaid),
                remainingAmount: roundAmount(computedRemaining),
                bookingTime: booking.booking_date || booking.created_at,
                travelers: travelers.map(t => ({
                    name: t.name,
                    age: t.age,
                    gender: t.gender
                }))
            };
        });

        // Calculate total cancellations from both sources
        // Combine cancellations from cancellation_bookings table and bookings with status='cancelled'
        const allCancelledBookings = [...cancelledBookingsFromStatus];
        
        // Add cancellations from cancellation_bookings table (avoid duplicates)
        cancellationBookings.forEach(cb => {
            const booking = bookings.find(b => b.id === cb.booking_id);
            if (booking && !allCancelledBookings.find(b => b.id === booking.id)) {
                allCancelledBookings.push(booking);
            }
        });
        
        const totalCancellations = allCancelledBookings.length;
        const totalCancelledSlots = allCancelledBookings.reduce((sum, booking) => {
            return sum + (booking.total_travelers || 0);
        }, 0);

        // Response data
        const responseData = {
            tbrId: batch.tbr_id,
            trekTitle: batch.trek.title,
            departureDate: batch.start_date,
            arrivalDate: batch.end_date,
            totalBookings: bookings.length,
            totalCustomers: bookings.length,
            totalCancellations: totalCancellations,
            totalCancelledSlots: totalCancelledSlots,
            customerBookings: customerBookingDetails
        };

        logger.trek("info", "Booking details by TBR retrieved successfully", {
            requestId,
            tbrId,
            vendorId,
            totalBookings: bookings.length,
            duration: `${Date.now() - startTime}ms`
        });

        res.json({
            success: true,
            data: responseData
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.trek("error", "Failed to get booking details by TBR", {
            requestId,
            tbrId: req.params.tbrId,
            vendorId: req.user?.id,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
        });

        res.status(500).json({
            success: false,
            message: "Failed to get booking details",
        });
    }
};

// Vendor: Get pending balance collection data
exports.getPendingBalanceCollection = async (req, res) => {
    const startTime = Date.now();
    const requestId = req.headers["x-request-id"] || `pending-balance-${Date.now()}`;

    try {
        const vendorId = req.user?.id;
        const {
            search = "",
            endDate = "",
            paymentStatus = "",
            page = 1,
            limit = 10,
        } = req.query;

        logger.trek("info", "Get pending balance collection request started", {
            requestId,
            vendorId,
            filters: { search, endDate, paymentStatus },
            pagination: { page, limit },
            ip: req.ip,
            userAgent: req.get("User-Agent"),
        });

        // Build where conditions
        const whereConditions = {
            vendor_id: vendorId,
            // Include ONLY partial payments with a positive remaining balance
            payment_status: 'partial',
            remaining_amount: { [Op.gt]: 0 },
        };

        // Search filter (name, trek title, TBR ID)
        if (search) {
            whereConditions[Op.or] = [
                { '$customer.name$': { [Op.like]: `%${search}%` } },
                { '$batch.trek.title$': { [Op.like]: `%${search}%` } },
                { '$batch.tbr_id$': { [Op.like]: `%${search}%` } },
            ];
        }

        // End date filter
        if (endDate) {
            whereConditions['$batch.end_date$'] = endDate;
        }

        // Payment status filter
        if (paymentStatus && paymentStatus === 'partial') {
            whereConditions.payment_status = 'partial';
        }

        // Calculate pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Get bookings with pending balances
        const { count, rows: bookings } = await Booking.findAndCountAll({
            where: whereConditions,
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['id', 'name', 'email', 'phone']
                },
                {
                    model: Batch,
                    as: 'batch',
                    attributes: ['id', 'tbr_id', 'start_date', 'end_date'],
                    include: [{
                        model: Trek,
                        as: 'trek',
                        attributes: ['id', 'title', 'destination_id', 'city_ids'],
                        include: [{
                            model: Destination,
                            as: 'destinationData',
                            attributes: ['id', 'name']
                        }]
                    }]
                },
                {
                    model: PaymentLog,
                    as: 'payments',
                    attributes: ['id', 'amount', 'payment_method', 'status', 'created_at']
                },
                {
                    model: BookingTraveler,
                    as: 'travelers',
                    include: [{
                        model: Traveler,
                        as: 'traveler',
                        attributes: ['id', 'name', 'age', 'gender']
                    }]
                }
            ],
            attributes: [
                'id', 'customer_id', 'batch_id', 'total_travelers', 'total_amount',
                'final_amount', 'advance_amount', 'remaining_amount', 'payment_status', 'status', 'booking_date', 'created_at'
            ],
            order: [['created_at', 'DESC']]
        });

        // Process bookings data
        const pendingBalanceData = await Promise.all(bookings.map(async (booking) => {
            // Use remaining_amount directly from booking table instead of calculating
            const totalAmount = parseFloat(booking.total_amount || 0);
            const remainingAmount = parseFloat(booking.remaining_amount || 0);
            // Paid should be fixed partial collection: 999 per traveler
            const travelers = parseInt(booking.total_travelers || 0, 10) || 0;
            const paidAmount = 999 * travelers;

            
            // Get source cities
            let sourceCityNames = [];
            if (booking.batch?.trek?.city_ids) {
                try {
                    const cityIds = JSON.parse(booking.batch.trek.city_ids);
                    if (Array.isArray(cityIds) && cityIds.length > 0) {
                        const cities = await City.findAll({
                            where: { id: { [Op.in]: cityIds } },
                            attributes: ['id', 'city_name']
                        });
                        sourceCityNames = cities.map(city => city.city_name);
                    }
                } catch (e) {
                    // If parsing fails, ignore
                }
            }

            // Get travelers info
            const travelerList = booking.travelers?.map(bt => bt.traveler) || [];
            const travelersInfo = travelerList.length > 0
                ? travelerList.map(t => `${t.name} (${t.age}/${t.gender.charAt(0).toUpperCase()})`).join(', ')
                : 'N/A';

            return {
                bookingId: booking.id,
                customerId: booking.customer_id,
                customerName: booking.customer?.name || 'N/A',
                customerEmail: booking.customer?.email || 'N/A',
                customerPhone: booking.customer?.phone || 'N/A',
                trekTitle: booking.batch?.trek?.title || 'N/A',
                tbrId: booking.batch?.tbr_id || 'N/A',
                destination: booking.batch?.trek?.destinationData?.name || 'N/A',
                sourceCities: sourceCityNames.join(', ') || 'N/A',
                totalTravelers: booking.total_travelers,
                travelersInfo,
                totalAmount: roundAmount(totalAmount),  // Total booking amount from bookings table
                paidAmount: roundAmount(paidAmount),    // Collected so far (partial): 999 * travelers
                remainingAmount: roundAmount(remainingAmount),  // Still pending
                paymentStatus: booking.payment_status,
                bookingStatus: booking.status,
                endDate: booking.batch?.end_date,
                bookingDate: booking.booking_date || booking.created_at,
            };
        }));

        logger.trek("info", "Pending balance collection data retrieved successfully", {
            requestId,
            vendorId,
            totalRecords: count,
            recordsReturned: pendingBalanceData.length,
            duration: `${Date.now() - startTime}ms`
        });

        res.json({
            success: true,
            data: {
                records: pendingBalanceData,
                totalRecords: count,
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / parseInt(limit)),
                hasMore: offset + pendingBalanceData.length < count
            }
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.trek("error", "Failed to get pending balance collection data", {
            requestId,
            vendorId: req.user?.id,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
        });

        res.status(500).json({
            success: false,
            message: "Failed to get pending balance collection data",
        });
    }
};

// Vendor: Mark payment as completed
exports.markPaymentCompleted = async (req, res) => {
    const startTime = Date.now();
    const requestId = req.headers["x-request-id"] || `mark-payment-${Date.now()}`;

    try {
        const { bookingId } = req.params;
        const vendorId = req.user?.id;

        logger.trek("info", "Mark payment completed request started", {
            requestId,
            bookingId,
            vendorId,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
        });

        // First verify the booking belongs to this vendor
        const booking = await Booking.findOne({
            where: {
                id: bookingId,
                vendor_id: vendorId
            },
            include: [{
                model: Customer,
                as: 'customer',
                attributes: ['name']
            }]
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found or you don't have permission to access it",
            });
        }

        // Update payment status to completed
        await booking.update({
            payment_status: 'completed'
        });

        logger.trek("info", "Payment marked as completed successfully", {
            requestId,
            bookingId,
            vendorId,
            customerName: booking.customer?.name,
            duration: `${Date.now() - startTime}ms`
        });

        res.json({
            success: true,
            message: "Payment marked as completed successfully",
            data: {
                bookingId: booking.id,
                paymentStatus: booking.payment_status
            }
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.trek("error", "Failed to mark payment as completed", {
            requestId,
            bookingId: req.params.bookingId,
            vendorId: req.user?.id,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
        });

        res.status(500).json({
            success: false,
            message: "Failed to mark payment as completed",
        });
    }
};

// Vendor: Add customer remark
exports.addCustomerRemark = async (req, res) => {
    const startTime = Date.now();
    const requestId = req.headers["x-request-id"] || `customer-remark-${Date.now()}`;

    try {
        const { bookingId } = req.params;
        const { remark } = req.body;
        const vendorId = req.user?.id;

        logger.trek("info", "Add customer remark request started", {
            requestId,
            bookingId,
            vendorId,
            remarkLength: remark?.length || 0,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
        });

        if (!remark || remark.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: "Remark is required",
            });
        }

        // First verify the booking belongs to this vendor
        const booking = await Booking.findOne({
            where: {
                id: bookingId,
                vendor_id: vendorId
            },
            include: [{
                model: Customer,
                as: 'customer',
                attributes: ['name']
            }]
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found or you don't have permission to access it",
            });
        }

        // Add or update the remark (assuming there's a remarks field in booking)
        await booking.update({
            vendor_remarks: remark.trim()
        });

        logger.trek("info", "Customer remark added successfully", {
            requestId,
            bookingId,
            vendorId,
            customerName: booking.customer?.name,
            duration: `${Date.now() - startTime}ms`
        });

        res.json({
            success: true,
            message: "Customer remark added successfully",
            data: {
                bookingId: booking.id,
                remark: booking.vendor_remarks
            }
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.trek("error", "Failed to add customer remark", {
            requestId,
            bookingId: req.params.bookingId,
            vendorId: req.user?.id,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
        });

        res.status(500).json({
            success: false,
            message: "Failed to add customer remark",
        });
    }
};

// Vendor: Delete trek
exports.deleteTrek = async (req, res) => {
    const startTime = Date.now();
    const requestId =
        req.headers["x-request-id"] || `delete-trek-${Date.now()}`;

    try {
        const { id } = req.params;
        const vendorId = req.user?.id;

        logger.trek("info", "Delete trek request started", {
            requestId,
            trekId: id,
            vendorId,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
        });

        if (!vendorId) {
            logger.trek("warn", "Delete trek access denied - no vendor ID", {
                requestId,
                trekId: id,
                vendorId,
            });
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Find the trek
        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
        });

        if (!trek) {
            logger.trek("warn", "Trek not found for deletion", {
                requestId,
                trekId: id,
                vendorId,
            });
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        logger.trek("info", "Trek found, starting deletion process", {
            requestId,
            trekId: id,
            trekTitle: trek.title,
            trekStatus: trek.status,
        });

        // Delete all related records first to avoid foreign key constraint issues

        // Delete associated images and files
        const images = await TrekImage.findAll({
            where: { trek_id: id },
        });

        logger.trek("info", "Found images to delete", {
            requestId,
            trekId: id,
            imageCount: images.length,
        });

        for (const image of images) {
            try {
                if (image.image_url) {
                    await deleteImage(image.image_url);
                    logger.trek("debug", "Image file deleted", {
                        requestId,
                        trekId: id,
                        imageUrl: image.image_url,
                    });
                }
            } catch (imageError) {
                logger.trek("error", "Failed to delete image file", {
                    requestId,
                    trekId: id,
                    imageUrl: image.image_url,
                    error: imageError.message,
                    stack: imageError.stack,
                });
            }
        }

        // Delete related records in the correct order with detailed logging
        const deletionSteps = [
            { name: "TrekImage", model: TrekImage },
            { name: "ItineraryItem", model: ItineraryItem },
            { name: "TrekStage", model: TrekStage },
            { name: "Accommodation", model: Accommodation },
            { name: "Batch", model: Batch },
            { name: "Review", model: Review },
            { name: "Rating", model: Rating },
        ];

        for (const step of deletionSteps) {
            try {
                const deletedCount = await step.model.destroy({
                    where: { trek_id: id },
                });
                logger.trek("info", `${step.name} records deleted`, {
                    requestId,
                    trekId: id,
                    deletedCount,
                    step: step.name,
                });
            } catch (stepError) {
                logger.trek("error", `Failed to delete ${step.name} records`, {
                    requestId,
                    trekId: id,
                    step: step.name,
                    error: stepError.message,
                    stack: stepError.stack,
                });
                throw stepError;
            }
        }


        // Finally delete the trek itself
        await trek.destroy();

        const duration = Date.now() - startTime;
        logger.trek("info", "Trek deleted successfully", {
            requestId,
            trekId: id,
            trekTitle: trek.title,
            duration: `${duration}ms`,
            deletedRecords: {
                images: images.length,
                itineraryItems: await ItineraryItem.count({
                    where: { trek_id: id },
                }),
                trekStages: await TrekStage.count({ where: { trek_id: id } }),
                accommodations: await Accommodation.count({
                    where: { trek_id: id },
                }),
                batches: await Batch.count({ where: { trek_id: id } }),
                reviews: await Review.count({ where: { trek_id: id } }),
                ratings: await Rating.count({ where: { trek_id: id } }),
            },
        });

        res.json({
            success: true,
            message: "Trek deleted successfully",
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.trek("error", "Failed to delete trek", {
            requestId,
            trekId: req.params.id,
            vendorId: req.user?.id,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            body: req.body,
            params: req.params,
            query: req.query,
        });

        res.status(500).json({
            success: false,
            message: "Failed to delete trek",
        });
    }
};

// Vendor: Update itinerary items
exports.updateItineraryItems = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;
        const { itineraryItems } = req.body;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify trek belongs to vendor
        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        // Delete existing itinerary items
        await ItineraryItem.destroy({
            where: { trek_id: id },
        });

        // Create new itinerary items
        const createdItems = [];
        if (itineraryItems && Array.isArray(itineraryItems)) {
            for (const item of itineraryItems) {
                const itineraryItem = await ItineraryItem.create({
                    trek_id: id,
                    activities: item.activities || [],
                });
                createdItems.push(itineraryItem);
            }
        }

        res.json({
            success: true,
            message: "Itinerary items updated successfully",
            data: createdItems,
        });
    } catch (error) {
        console.error("Error updating itinerary items:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update itinerary items",
        });
    }
};

// Vendor: Update trek stages
exports.updateTrekStages = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;
        const { trekStages } = req.body;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify trek belongs to vendor
        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        // Delete existing trek stages
        await TrekStage.destroy({
            where: { trek_id: id },
        });

        // Create new trek stages
        const createdStages = [];
        if (trekStages && Array.isArray(trekStages)) {
            for (const stage of trekStages) {
                const trekStage = await TrekStage.create({
                    trek_id: id,
                    batch_id: stage.batch_id, // Now required
                    stage_name: stage.stage_name,
                    destination: stage.destination || "",
                    means_of_transport: stage.means_of_transport || "",
                    date_time: stage.date_time, // Full date-time from frontend
                    is_boarding_point: stage.is_boarding_point || false,
                    city_id: stage.city_id || null,
                });
                createdStages.push(trekStage);
            }
        }

        res.json({
            success: true,
            message: "Trek stages updated successfully",
            data: createdStages,
        });
    } catch (error) {
        console.error("Error updating trek stages:", error);
        logger.trek("error", "Failed to update trek stages", {
            trekId: id,
            vendorId: req.user?.id,
            error: error.message,
            stack: error.stack,
            requestBody: req.body,
        });
        res.status(500).json({
            success: false,
            message: "Failed to update trek stages",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Vendor: Update accommodations
exports.updateAccommodations = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;
        const { accommodations } = req.body;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify trek belongs to vendor
        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        // Check if trek has already been edited
        if (trek.has_been_edited === 1) {
            return res.status(400).json({
                success: false,
                message:
                    "This trek has already been edited and cannot be modified further",
            });
        }

        // Delete existing accommodations
        await Accommodation.destroy({
            where: { trek_id: id },
        });

        // Create new accommodations
        const createdAccommodations = [];
        if (accommodations && Array.isArray(accommodations)) {
            for (const accommodation of accommodations) {
                const newAccommodation = await Accommodation.create({
                    trek_id: id,
                    type: accommodation.type || "",
                    details: {
                        night:
                            accommodation.details?.night ||
                            accommodation.night ||
                            1,
                        location:
                            accommodation.details?.location ||
                            accommodation.location ||
                            "",
                    },
                });
                createdAccommodations.push(newAccommodation);
            }
        }

        // Mark trek as edited
        await trek.update({ has_been_edited: 1 });

        res.json({
            success: true,
            message: "Accommodations updated successfully",
            data: createdAccommodations,
        });
    } catch (error) {
        console.error("Error updating accommodations:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update accommodations",
        });
    }
};

// Vendor: Create batches
exports.createBatches = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;
        const { batches } = req.body;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify trek belongs to vendor
        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        // Check for duplicate treks (same vendor, destination, and same start date)
        if (batches && Array.isArray(batches) && batches.length > 0) {
            // Validate batch data
            for (const batch of batches) {
                if (!batch.start_date || !batch.end_date) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "All batches must have start_date and end_date",
                        error: "INVALID_BATCH_DATA",
                    });
                }

                // Validate date format and logic
                const startDate = new Date(batch.start_date);
                const endDate = new Date(batch.end_date);

                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid date format for batch dates",
                        error: "INVALID_DATE_FORMAT",
                    });
                }

                if (startDate >= endDate) {
                    return res.status(400).json({
                        success: false,
                        message: "Batch start date must be before end date",
                        error: "INVALID_DATE_RANGE",
                    });
                }

                // Check if dates are in the past
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (startDate < today) {
                    return res.status(400).json({
                        success: false,
                        message: "Cannot create batches with dates in the past",
                        error: "PAST_DATES_NOT_ALLOWED",
                    });
                }
            }

            const duplicateCheck = await checkDuplicateTrek(
                vendorId,
                trek.destination_id,
                batches
            );

            if (duplicateCheck.hasDuplicate) {
                const { duplicateInfo } = duplicateCheck;
                return res.status(400).json({
                    success: false,
                    message:
                        "Cannot create batches for this trek. You already have an active trek for the same destination with the same start date.",
                    error: "DUPLICATE_TREK",
                    details: {
                        existingTrekId: duplicateInfo.trekId,
                        existingTrekTitle: duplicateInfo.trekTitle,
                        existingStartDate: duplicateInfo.existingStartDate,
                        existingEndDate: duplicateInfo.existingEndDate,
                        conflictingStartDate: duplicateInfo.newStartDate,
                        conflictingEndDate: duplicateInfo.newEndDate,
                        suggestion:
                            "Please choose different dates or modify your existing trek.",
                    },
                });
            }
        }

        // Delete existing batches
        await Batch.destroy({
            where: { trek_id: id },
        });

        // Create new batches
        const createdBatches = [];
        if (batches && Array.isArray(batches)) {
            for (const batch of batches) {
                // Generate TBR ID
                const generateTbrId = () => {
                    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                    let result = "TBR";
                    for (let i = 0; i < 7; i++) {
                        result += chars.charAt(
                            Math.floor(Math.random() * chars.length)
                        );
                    }
                    return result;
                };

                const batchData = {
                    tbr_id: generateTbrId(),
                    trek_id: id,
                    start_date: batch.start_date,
                    end_date: batch.end_date,
                    capacity: batch.capacity || trek.max_participants,
                    booked_slots: 0,
                    available_slots: batch.capacity || trek.max_participants,
                };

                const newBatch = await Batch.create(batchData);
                createdBatches.push(newBatch);
            }
        }

        logger.trek("info", "Batches created successfully", {
            trekId: id,
            vendorId,
            batchCount: createdBatches.length,
            batches: createdBatches.map((b) => ({
                id: b.id,
                start_date: b.start_date,
                end_date: b.end_date,
            })),
        });

        res.json({
            success: true,
            message: "Batches created successfully",
            data: createdBatches,
        });
    } catch (error) {
        logger.trek("error", "Failed to create batches", {
            trekId: req.params.id,
            vendorId: req.user?.id,
            error: error.message,
            stack: error.stack,
        });
        res.status(500).json({
            success: false,
            message: "Failed to create batches",
        });
    }
};

// Vendor: Update batches
exports.updateBatches = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;
        const { batches } = req.body;

        if (!vendorId) {
            return res.status(404).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify trek belongs to vendor
        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        // Check for duplicate treks (same vendor, destination, and same start date)
        // Exclude the current trek from the duplicate check
        if (batches && Array.isArray(batches) && batches.length > 0) {
            // Validate batch data
            for (const batch of batches) {
                if (!batch.start_date || !batch.end_date) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "All batches must have start_date and end_date",
                        error: "INVALID_BATCH_DATA",
                    });
                }

                // Validate date format and logic
                const startDate = new Date(batch.start_date);
                const endDate = new Date(batch.end_date);

                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid date format for batch dates",
                        error: "INVALID_DATE_FORMAT",
                    });
                }

                if (startDate >= endDate) {
                    return res.status(400).json({
                        success: false,
                        message: "Batch start date must be before end date",
                        error: "INVALID_DATE_RANGE",
                    });
                }

                // Check if dates are in the past
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (startDate < today) {
                    return res.status(400).json({
                        success: false,
                        message: "Cannot create batches with dates in the past",
                        error: "PAST_DATES_NOT_ALLOWED",
                    });
                }
            }

            const duplicateCheck = await checkDuplicateTrek(
                vendorId,
                trek.destination_id,
                batches,
                id
            );

            if (duplicateCheck.hasDuplicate) {
                const { duplicateInfo } = duplicateCheck;
                return res.status(400).json({
                    success: false,
                    message:
                        "Cannot update batches for this trek. You already have an active trek for the same destination with the same start date.",
                    error: "DUPLICATE_TREK",
                    details: {
                        existingTrekId: duplicateInfo.trekId,
                        existingTrekTitle: duplicateInfo.trekTitle,
                        existingStartDate: duplicateInfo.existingStartDate,
                        existingEndDate: duplicateInfo.existingEndDate,
                        conflictingStartDate: duplicateInfo.newStartDate,
                        conflictingEndDate: duplicateInfo.newEndDate,
                        suggestion:
                            "Please choose different dates or modify your existing trek.",
                    },
                });
            }
        }

        // Delete existing batches
        await Batch.destroy({
            where: { trek_id: id },
        });

        // Create new batches
        const createdBatches = [];
        if (batches && Array.isArray(batches)) {
            for (const batch of batches) {
                // Generate TBR ID
                const generateTbrId = () => {
                    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                    let result = "TBR";
                    for (let i = 0; i < 7; i++) {
                        result += chars.charAt(
                            Math.floor(Math.random() * chars.length)
                        );
                    }
                    return result;
                };

                const batchData = {
                    tbr_id: generateTbrId(),
                    trek_id: id,
                    start_date: batch.start_date,
                    end_date: batch.end_date,
                    capacity: batch.capacity || trek.max_participants,
                    booked_slots: 0,
                    available_slots: batch.capacity || trek.max_participants,
                };

                const newBatch = await Batch.create(batchData);
                createdBatches.push(newBatch);
            }
        }

        res.json({
            success: true,
            message: "Batches updated successfully",
            data: createdBatches,
        });
    } catch (error) {
        console.error("Error updating batches:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update batches",
        });
    }
};

// Vendor: Get batches
exports.getBatches = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify trek belongs to vendor
        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        const batches = await Batch.findAll({
            where: { trek_id: id },
            order: [["start_date", "ASC"]],
        });

        res.json({
            success: true,
            data: batches,
        });
    } catch (error) {
        console.error("Error fetching batches:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch batches",
        });
    }
};

// Vendor: Upload trek images
exports.uploadTrekImages = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;
        const { images } = req.body;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify trek belongs to vendor
        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        // Delete existing images
        const existingImages = await TrekImage.findAll({
            where: { trek_id: id },
        });

        for (const image of existingImages) {
            await deleteImage(image.url);
            await image.destroy();
        }

        // Upload new images
        const uploadedImages = [];
        if (images && Array.isArray(images)) {
            for (const imageData of images) {
                try {
                    // Accept both images[].data and images[].preview
                    let base64 = imageData?.data || imageData?.preview || "";
                    if (!base64 || typeof base64 !== "string") {
                        continue; // skip invalid entries silently
                    }
                    // Normalize if prefix missing
                    if (!base64.startsWith("data:image")) {
                        base64 = `data:image/jpeg;base64,${base64}`;
                    }

                    // Save image to file system
                    const imagePath = await saveBase64Image(base64, vendorId);

                    // Create image record in database
                    const image = await TrekImage.create({
                        trek_id: id,
                        url: imagePath,
                        is_cover: Boolean(imageData.is_cover || imageData.isCover) || false,
                    });

                    uploadedImages.push(image);
                } catch (imageError) {
                    console.error("Error uploading image:", imageError);
                    // Continue with other images even if one fails
                }
            }
        }

        res.json({
            success: true,
            message: "Images uploaded successfully",
            data: uploadedImages,
        });
    } catch (error) {
        console.error("Error uploading trek images:", error);
        res.status(500).json({
            success: false,
            message: "Failed to upload images",
        });
    }
};

// Vendor: Toggle trek status
exports.toggleTrekStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        // Vendors can only activate treks that have been approved by admin
        if (trek.status !== "active" && trek.trek_status !== "approved") {
            return res.status(403).json({
                success: false,
                message: "Trek cannot be activated until it has been approved by an admin.",
            });
        }

        const newStatus = trek.status === "active" ? "deactive" : "active";
        await trek.update({ status: newStatus });

        res.json({
            success: true,
            message: `Trek ${newStatus} successfully`,
            data: trek,
        });
    } catch (error) {
        console.error("Error toggling trek status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to toggle trek status",
        });
    }
};

// Vendor: Get trek batches
exports.getTrekBatches = async (req, res) => {
    try {
        const { id } = req.params;
        const vendorId = req.user?.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify trek belongs to vendor
        const trek = await Trek.findOne({
            where: { id: id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        const batches = await Batch.findAll({
            where: { trek_id: id },
            order: [["start_date", "ASC"]],
        });

        const transformedBatches = batches.map((batch) => ({
            id: batch.id,
            startDate: batch.start_date,
            endDate: batch.end_date,
            capacity: batch.capacity,
            bookedSlots: batch.booked_slots || 0,
            availableSlots:
                batch.available_slots ||
                batch.capacity - (batch.booked_slots || 0),
            isAvailable:
                (batch.available_slots ||
                    batch.capacity - (batch.booked_slots || 0)) > 0,
        }));

        res.json({
            success: true,
            data: transformedBatches,
        });
    } catch (error) {
        console.error("Error fetching trek batches:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch trek batches",
        });
    }
};

// Vendor: Create itinerary items for trek
exports.createItineraryItems = async (req, res) => {
    try {
        const { itineraryItems } = req.body;
        const trek_id = req.params.id;
        const vendorId = req.user?.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify trek belongs to vendor
        const trek = await Trek.findOne({
            where: { id: trek_id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        const createdItems = [];
        for (const item of itineraryItems) {
            const itineraryItem = await ItineraryItem.create({
                trek_id: trek_id,
                activities: item.activities,
            });
            createdItems.push(itineraryItem);
        }

        res.status(201).json({
            success: true,
            message: `${createdItems.length} itinerary items created successfully`,
            data: createdItems,
        });
    } catch (error) {
        console.error("Error creating itinerary items:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create itinerary items",
        });
    }
};

// Vendor: Create trek stages for trek
exports.createTrekStages = async (req, res) => {
    try {
        const { trekStages } = req.body;
        const trek_id = req.params.id;
        const vendorId = req.user?.id;

        logger.trek("info", "Creating trek stages", {
            trekId: trek_id,
            vendorId: vendorId,
            trekStagesCount: trekStages?.length || 0,
            trekStages: trekStages,
        });

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify trek belongs to vendor
        const trek = await Trek.findOne({
            where: { id: trek_id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        const createdStages = [];
        for (const stage of trekStages) {
            const trekStage = await TrekStage.create({
                trek_id: trek_id,
                batch_id: stage.batch_id, // Now required
                stage_name: stage.stage_name,
                destination: stage.destination,
                means_of_transport: stage.means_of_transport,
                date_time: stage.date_time, // Full date-time from frontend
                is_boarding_point: stage.is_boarding_point || false,
                city_id: stage.city_id || null,
            });
            createdStages.push(trekStage);
        }

        res.status(201).json({
            success: true,
            message: `${createdStages.length} trek stages created successfully`,
            data: createdStages,
        });
    } catch (error) {
        console.error("Error creating trek stages:", error);
        logger.trek("error", "Failed to create trek stages", {
            trekId: trek_id,
            vendorId: req.user?.id,
            error: error.message,
            stack: error.stack,
            requestBody: req.body,
        });
        res.status(500).json({
            success: false,
            message: "Failed to create trek stages",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// Vendor: Create accommodations for trek
exports.createAccommodations = async (req, res) => {
    try {
        const { accommodations } = req.body;
        const trek_id = req.params.id;
        const vendorId = req.user?.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify trek belongs to vendor
        const trek = await Trek.findOne({
            where: { id: trek_id, vendor_id: vendorId },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        const createdAccommodations = [];
        for (const acc of accommodations) {
            const accommodation = await Accommodation.create({
                trek_id: trek_id,
                type: acc.type || "",
                details: {
                    night: acc.details?.night || acc.night || 1,
                    location: acc.details?.location || acc.location || "",
                },
            });
            createdAccommodations.push(accommodation);
        }

        res.status(201).json({
            success: true,
            message: `${createdAccommodations.length} accommodations created successfully`,
            data: createdAccommodations,
        });
    } catch (error) {
        console.error("Error creating accommodations:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create accommodations",
        });
    }
};


// Vendor: Get TBR statistics
exports.getTbrStatistics = async (req, res) => {
    try {
        const vendorId = req.user?.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Get all treks with TBR IDs for this vendor
        const treks = await Trek.findAll({
            where: {
                vendor_id: vendorId,
                tbr_id: { [sequelize.Op.ne]: null }, // Only treks with TBR IDs
            },
            include: [
                {
                    model: Batch,
                    as: "batches",
                    required: false,
                    attributes: ["id", "booked_slots", "capacity"],
                },
            ],
        });

        // Calculate statistics
        const totalTbrs = treks.length;
        const activeTbrs = treks.filter(
            (trek) => trek.status === "active"
        ).length;
        const pendingTbrs = treks.filter(
            (trek) => trek.status === "deactive"
        ).length;
        const totalBookings = treks.reduce((total, trek) => {
            return (
                total +
                (trek.batches?.reduce(
                    (batchTotal, batch) => batchTotal + batch.booked_slots,
                    0
                ) || 0)
            );
        }, 0);

        res.json({
            success: true,
            data: {
                totalTbrs,
                activeTbrs,
                pendingTbrs,
                totalBookings,
                treks: treks.map((trek) => ({
                    id: trek.id,
                    tbr_id: trek.tbr_id,
                    title: trek.title,
                    status: trek.status,
                    totalBatches: trek.batches?.length || 0,
                    totalBookings:
                        trek.batches?.reduce(
                            (total, batch) => total + batch.booked_slots,
                            0
                        ) || 0,
                })),
            },
        });
    } catch (error) {
        console.error("Error getting TBR statistics:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get TBR statistics",
        });
    }
};

// Controller function to check for duplicate treks (for frontend validation)
exports.checkDuplicateTrek = async (req, res) => {
    try {
        const vendorId = req.user?.id;
        const { destination_id, batches } = req.body;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        if (!destination_id || !batches || !Array.isArray(batches)) {
            return res.status(400).json({
                success: false,
                message: "Destination ID and batches are required",
            });
        }

        // Check for duplicates using the helper function
        const duplicateCheck = await checkDuplicateTrek(
            vendorId,
            destination_id,
            batches
        );

        res.json({
            success: true,
            data: duplicateCheck,
        });
    } catch (error) {
        console.error("Error checking duplicate trek:", error);
        res.status(500).json({
            success: false,
            message: "Failed to check for duplicate treks",
            error: error.message,
        });
    }
};

// Controller function to request batch cancellation
exports.requestBatchCancellation = async (req, res) => {
    try {
        const vendorId = req.user?.id;
        const { batchId } = req.params;
        const { reason, recordDetails } = req.body;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        if (!batchId || !reason) {
            return res.status(400).json({
                success: false,
                message: "Batch ID and reason are required",
            });
        }

        if (reason.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: "Reason must be at least 10 characters long",
            });
        }

        // Verify that the batch belongs to a trek owned by the vendor
        const batch = await Batch.findOne({
            where: {
                id: batchId,
            },
            include: [{
                model: Trek,
                as: 'trek',
                where: {
                    vendor_id: vendorId,
                },
                attributes: ['id', 'vendor_id', 'title'],
            }],
        });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: "Batch not found or you don't have permission to request cancellation for this batch",
            });
        }

        // Check if there's already a pending request for this TBR
        const existingRequest = await BatchCancellationRequest.findOne({
            where: {
                batch_id: batchId,
                status: 'pending',
            },
        });

        if (existingRequest) {
            return res.status(409).json({
                success: false,
                message: "A batch cancellation request is already pending for this batch",
            });
        }

        // Create the batch cancellation request
        const cancellationRequest = await BatchCancellationRequest.create({
            batch_id: batchId,
            vendor_id: vendorId,
            reason: reason.trim(),
            record_details: recordDetails || null,
            status: 'pending',
        });

        logger.info(`Batch cancellation request created for batch ${batchId} by vendor ${vendorId}`, {
            category: "trek",
            requestId: cancellationRequest.id,
            batchId,
            vendorId,
            reason: reason.trim(),
        });

        res.json({
            success: true,
            message: "Batch cancellation request submitted successfully",
            data: {
                requestId: cancellationRequest.id,
                batchId,
                status: cancellationRequest.status,
                requestedAt: cancellationRequest.requested_at,
            },
        });
    } catch (error) {
        logger.error("Error creating batch cancellation request:", error, {
            category: "trek",
            batchId: req.params.batchId,
            vendorId: req.user?.id,
        });
        res.status(500).json({
            success: false,
            message: "Failed to submit batch cancellation request",
            error: error.message,
        });
    }
};
