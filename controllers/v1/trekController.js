const {
    Trek,
    Vendor,
    User,
    ItineraryItem,
    Accommodation,
    TrekImage,
    TrekStage,
    Batch,
    Destination,
    City,
    Review,
    Rating,
    Customer,
    Activity,
    Badge,
    CancellationPolicy,
    Inclusion,
} = require("../../models");
const { Op } = require("sequelize");
const { sequelize } = require("../../models");

// Helper function to parse date-time strings in various formats
const parseDateTimeString = (dateTimeStr) => {
    if (!dateTimeStr) return null;
    
    // Try parsing as-is first
    let date = new Date(dateTimeStr);
    if (!isNaN(date.getTime())) {
        return date;
    }
    
    // Handle format like "2025-10-08 07:00 AM"
    const match = dateTimeStr.match(/(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (match) {
        const [, datePart, hours, minutes, period] = match;
        let hour = parseInt(hours);
        
        // Convert 12-hour to 24-hour format
        if (period) {
            if (period.toUpperCase() === 'PM' && hour !== 12) {
                hour += 12;
            } else if (period.toUpperCase() === 'AM' && hour === 12) {
                hour = 0;
            }
        }
        
        const isoString = `${datePart}T${hour.toString().padStart(2, '0')}:${minutes}:00`;
        return new Date(isoString);
    }
    
    return null;
};

// Mobile: Get all active treks
exports.getAllTreks = async (req, res) => {
    try {
        const { page = 1, limit = 10, destination_id, city_id, min_price, max_price, duration_days, start_date } = req.query;
        const offset = (page - 1) * limit;

        // ✅ ADMIN CONTROL: Only show approved treks
        const whereClause = {
            status: "active",
            trek_status: "approved",
            approval_status: "approved",  // Admin approved only
            visibility: true              // Admin enabled visibility
        };

        if (destination_id) {
            whereClause.destination_id = destination_id;
        }

        if (city_id) {
            // MariaDB-compatible: city_ids may be stored as integers [1,2] or strings ["1","2"]
            // Match both forms so the query works regardless of how the column was populated
            const numericCityId = parseInt(city_id);
            if (!Number.isNaN(numericCityId)) {
                // Ensure Op.and exists or create it
                whereClause[Op.and] = whereClause[Op.and] || [];
                whereClause[Op.and].push(
                    sequelize.literal(
                        `(JSON_CONTAINS(city_ids, ${numericCityId}, '$') OR JSON_CONTAINS(city_ids, '"${numericCityId}"', '$') OR city_ids LIKE '%"${numericCityId}"%' OR city_ids LIKE '%${numericCityId}%')`
                    )
                );
            }
            delete whereClause.city_id; // Ensure we don't have a double filter
        }

        if (min_price || max_price) {
            whereClause.base_price = {};
            if (min_price) whereClause.base_price[Op.gte] = min_price;
            if (max_price) whereClause.base_price[Op.lte] = max_price;
        }

        if (duration_days) {
            whereClause.duration_days = duration_days;
        }

        // Build includes array
        const includes = [
            {
                model: Vendor,
                as: "vendor",
                attributes: ["id"],
                include: [
                    {
                        model: User,
                        as: "user",
                        attributes: ["id", "name", "email", "phone"],
                    },
                ],
            },
            {
                model: Destination,
                as: "destinationData",
                attributes: ["id", "name"],
            },
            {
                model: Badge,
                as: "badge",
                attributes: ["id", "name", "icon", "color", "category"],
                where: { is_active: true },
                required: false,
            },
            {
                model: TrekImage,
                as: "images",
                required: false,
                attributes: ["id", "url", "is_cover"],
            },
            {
                model: Rating,
                as: "ratings",
                required: false,
                attributes: ["rating_value"],
            },
        ];

        // If start_date is provided, include batches with date filtering
        // Show treks whose batch start_date is ON or AFTER the provided date
        if (start_date) {
            includes.push({
                model: Batch,
                as: "batches",
                where: {
                    start_date: { [Op.gte]: new Date(start_date) },
                },
                required: true, // INNER JOIN to only get treks with matching batches
                attributes: ["id", "start_date", "end_date", "available_slots", "capacity"],
            });
        }

        // Always include trek stages to check start time
        includes.push({
            model: TrekStage,
            as: "trek_stages",
            required: false,
            attributes: ["id", "batch_id", "stage_name", "date_time", "is_boarding_point", "city_id"],
        });

        const { count, rows: treks } = await Trek.findAndCountAll({
            where: whereClause,
            include: includes,
            order: [["created_at", "DESC"]],
            limit: parseInt(limit),
            offset: parseInt(offset),
        });

        // Filter out treks that have already started
        // NOTE: When start_date filter is applied, we already restrict batches to start_date >= param,
        // so we should NOT further exclude by trek_stages boarding times (which can be a day earlier).
        const now = new Date();
        const availableTreks = treks.filter((trek) => {
            if (!start_date) {
                const trekData = trek.toJSON();
                const boardingStages = (trekData.trek_stages || []).filter((s) => s.is_boarding_point);
                if (boardingStages.length > 0) {
                    const earliestStage = boardingStages.reduce((earliest, current) => {
                        const currentTime = parseDateTimeString(current.date_time);
                        const earliestTime = parseDateTimeString(earliest.date_time);
                        return currentTime < earliestTime ? current : earliest;
                    });
                    const startDateTime = parseDateTimeString(earliestStage.date_time);
                    if (startDateTime && startDateTime <= now) {
                        return false;
                    }
                }
            }
            return true;
        });

        // Calculate minimum required boarding time (current time + 6 hours in IST)
        const nowIST = new Date();
        const minimumBoardingTime = new Date(nowIST.getTime() + (6 * 60 * 60 * 1000)); // Add 6 hours

        // Format the response to match Flutter model
        const formattedTreks = availableTreks.map((trek) => {
            const trekData = trek.toJSON();

            // Calculate final price (considering discounts)
            let finalPrice = trekData.base_price;
            let discountText = null;

            if (trekData.has_discount && trekData.discount_type === "percentage") {
                const discountAmount = (trekData.base_price * trekData.discount_value) / 100;
                finalPrice = Math.round(trekData.base_price - discountAmount);
                discountText = `${trekData.discount_value}% OFF`;
            } else if (trekData.has_discount && trekData.discount_type === "fixed") {
                finalPrice = Math.round(trekData.base_price - trekData.discount_value);
                discountText = `₹${trekData.discount_value} OFF`;
            }

            // Get the first batch info (if start_date filter was applied, there should be matching batches)
            let batchInfo = null;
            let boardingDateTime = null;

            if (trekData.batches && trekData.batches.length > 0) {
                // Sort ascending by start_date
                const sortedBatches = [...trekData.batches].sort(
                    (a, b) => new Date(a.start_date) - new Date(b.start_date)
                );

                // If a start_date was searched, prefer the batch that falls on that exact date.
                // Fall back to the earliest batch if none matches exactly.
                let batch = sortedBatches[0];
                if (start_date) {
                    const searchDateStr = new Date(start_date).toISOString().split('T')[0];
                    const exactMatch = sortedBatches.find(b =>
                        new Date(b.start_date).toISOString().split('T')[0] === searchDateStr
                    );
                    if (exactMatch) batch = exactMatch;
                }
                batchInfo = {
                    id: batch.id,
                    // Return as YYYY-MM-DD so Flutter can compare dates without time mismatch
                    startDate: new Date(batch.start_date).toISOString().split('T')[0],
                    availableSlots: batch.available_slots
                };

                // Find the boarding stage for this batch and city to get the start time and validate 6-hour buffer
                if (trekData.trek_stages && city_id) {
                    // When start_date is provided, find boarding stage matching that specific date
                    const boardingStage = trekData.trek_stages.find(stage => {
                        if (stage.batch_id !== batch.id || stage.city_id != city_id ||
                            stage.stage_name !== "boarding" || stage.is_boarding_point !== true) {
                            return false;
                        }

                        // If start_date filter is applied, match the boarding date with search date
                        if (start_date && stage.date_time) {
                            const boardingDate = stage.date_time.match(/(\d{4}-\d{2}-\d{2})/);
                            if (boardingDate) {
                                const searchDate = new Date(start_date).toISOString().split('T')[0];
                                return boardingDate[1] === searchDate;
                            }
                            return false;
                        }

                        return true;
                    });

                    if (boardingStage && boardingStage.date_time) {
                        // Parse the boarding date_time
                        boardingDateTime = parseDateTimeString(boardingStage.date_time);

                        // Extract time from date_time field (format: "2025-09-05 06:00 AM")
                        const timeMatch = boardingStage.date_time.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
                        if (timeMatch) {
                            batchInfo.startTime = timeMatch[1].trim();
                        }
                    }
                }
            }

            // Only filter if a boarding stage was found AND it's within the 6-hour cutoff AND not searching a future date.
            // If no stage was found for this city, the trek still passed the DB-level city_ids
            // filter so we leave it visible — don't silently drop it.
            const isFutureSearch = start_date && new Date(start_date) > new Date();
            const shouldFilter = !isFutureSearch && boardingDateTime && boardingDateTime < minimumBoardingTime;

            // Calculate average rating from ratings array
            let averageRating = 0.0;
            if (trekData.ratings && trekData.ratings.length > 0) {
                const sum = trekData.ratings.reduce((total, rating) => total + parseFloat(rating.rating_value), 0);
                averageRating = parseFloat((sum / trekData.ratings.length).toFixed(1));
            }

            // Format badge info
            let badge = null;
            if (trekData.badge) {
                badge = {
                    id: trekData.badge.id,
                    name: trekData.badge.name,
                    icon: trekData.badge.icon,
                    color: trekData.badge.color,
                    category: trekData.badge.category
                };
            }

            // Return only the fields needed for Flutter model
            return {
                id: trekData.id,
                name: trekData.title,
                vendor: trekData.vendor?.user?.name || null,
                hasDiscount: trekData.has_discount || false,
                discountText: discountText,
                rating: averageRating,
                price: finalPrice.toString(),
                duration: trekData.duration || `${trekData.duration_days}D ${trekData.duration_nights}N`,
                batchInfo: batchInfo,
                badge: badge,
                _shouldFilter: shouldFilter // Internal flag for filtering
            };
        });

        // Filter out treks with 0 available slots and treks starting within 6 hours
        const treksWithAvailableSlots = formattedTreks.filter(trek => {
            // Remove treks that don't meet the 6-hour advance booking requirement
            if (trek._shouldFilter) {
                return false;
            }

            // Remove treks with no available slots
            if (trek.batchInfo && trek.batchInfo.availableSlots !== undefined) {
                return trek.batchInfo.availableSlots > 0;
            }
            return true; // Keep treks without batchInfo
        });

        // Remove the internal _shouldFilter flag from the response
        treksWithAvailableSlots.forEach(trek => {
            delete trek._shouldFilter;
        });

        res.json({
            success: true,
            data: treksWithAvailableSlots,
            count: treksWithAvailableSlots.length, // Return filtered count
        });
    } catch (error) {
        console.error("Error fetching treks:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch treks",
            error: error.message,
        });
    }
};

// Mobile: Get trek by ID
exports.getTrekById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Looking for trek with id:", id);
        
        // ✅ ADMIN CONTROL: Only show approved treks
        const trek = await Trek.findOne({
            where: {
                id,
                trek_status: "approved",
                approval_status: "approved",  // Admin approved only
                visibility: true              // Admin enabled visibility
            },
            include: [
                {
                    model: Vendor,
                    as: "vendor",
                    attributes: ["id"],
                    include: [
                        {
                            model: User,
                            as: "user",
                            attributes: ["id", "name", "email", "phone"],
                        },
                    ],
                },
                {
                    model: Destination,
                    as: "destinationData",
                    attributes: ["id", "name"],
                },
                {
                    model: Badge,
                    as: "badge",
                    attributes: ["id", "name", "icon", "color", "category"],
                    where: { is_active: true },
                    required: false,
                },
                {
                    model: TrekStage,
                    as: "trek_stages",
                    required: false,
                    attributes: ["id", "stage_name", "destination", "means_of_transport", "date_time", "is_boarding_point", "batch_id", "city_id"],
                    include: [
                        {
                            model: City,
                            as: "city",
                            required: false,
                            attributes: ["id", "cityName"],
                        },
                    ],
                },
                {
                    model: Accommodation,
                    as: "accommodations",
                    required: false,
                },
                {
                    model: ItineraryItem,
                    as: "itinerary_items",
                    required: false,
                },
                {
                    model: TrekImage,
                    as: "images",
                    required: false,
                    attributes: ["id", "url", "is_cover"],
                },
            ],
        });
        
        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        let trekData = trek.toJSON();

        // Apply batch_id and city_id filtering
        const { batch_id, city_id } = req.query;
        
        if (batch_id) {
            // Filter accommodations by batch_id
            if (trekData.accommodations) {
                trekData.accommodations = trekData.accommodations.filter(acc => acc.batch_id == batch_id);
            }
            
            // Filter trek_stages by batch_id
            if (trekData.trek_stages) {
                trekData.trek_stages = trekData.trek_stages.filter(stage => stage.batch_id == batch_id);
            }
        }
        
        if (city_id) {
            // Filter only "boarding" stages by city_id, keep other stages
            if (trekData.trek_stages) {
                trekData.trek_stages = trekData.trek_stages.filter(stage => {
                    if (stage.stage_name === "boarding") {
                        return stage.city_id == city_id;
                    }
                    return true; // Keep non-boarding stages
                });
            }
        }

        // Calculate average rating for the trek
        let ratings = [];
        let averageRating = 0;
        let ratingTotal = 0;
        try {
            ratings = await Rating.findAll({
                where: { trek_id: id },
                attributes: ['rating_value', 'content']
            });

            if (ratings.length > 0) {
                const totalRating = ratings.reduce((sum, rating) => sum + parseFloat(rating.rating_value), 0);
                ratingTotal = totalRating; // Sum of all rating values
                averageRating = (totalRating / ratings.length).toFixed(1);
            }
        } catch (ratingError) {
            console.log("Rating fetch error:", ratingError.message);
            ratings = [];
        }

        // Calculate review comments count (reviews with non-empty content)
        let reviewCommentsCount = 0;
        try {
            reviewCommentsCount = await Rating.count({
                where: { 
                    trek_id: id,
                    content: {
                        [Op.ne]: null, // Not null
                        [Op.ne]: ''    // Not empty string
                    }
                }
            });
        } catch (reviewCountError) {
            console.log("Review count error:", reviewCountError.message);
            reviewCommentsCount = 0;
        }

        // Get latest 5 customer reviews with rating values (by ID descending - last added)
        let latestReviews = [];
        try {
            latestReviews = await Rating.findAll({
                where: { trek_id: id },
                include: [
                    {
                        model: Customer,
                        as: "customer",
                        attributes: ["id", "name", "phone"],
                    },
                ],
                order: [["id", "DESC"]], // Order by ID descending to get last added reviews
                limit: 5,
            });
            
            // Debug: Log the first review to see available fields
            if (latestReviews.length > 0) {
                console.log("First review fields:", Object.keys(latestReviews[0].dataValues));
                console.log("Created at value:", latestReviews[0].created_at || latestReviews[0].createdAt);
            }
        } catch (reviewError) {
            console.log("Review fetch error:", reviewError.message);
            latestReviews = [];
        }

        // Calculate category-wise ratings
        const totalReviews = ratings.length;
        let categoryRatings = {
            safety_security: 0,
            organizer_manner: 0,
            trek_planning: 0,
            women_safety: 0
        };

        if (totalReviews > 0) {
            const safetyPercentage = (trekData.safety_security_count / totalReviews) * 100;
            const organizerPercentage = (trekData.organizer_manner_count / totalReviews) * 100;
            const planningPercentage = (trekData.trek_planning_count / totalReviews) * 100;
            const womenPercentage = (trekData.women_safety_count / totalReviews) * 100;

            // Convert percentage to 5-star rating (100% = 5 stars)
            categoryRatings.safety_security = Math.round((safetyPercentage / 100) * 5 * 10) / 10; // Round to 1 decimal
            categoryRatings.organizer_manner = Math.round((organizerPercentage / 100) * 5 * 10) / 10;
            categoryRatings.trek_planning = Math.round((planningPercentage / 100) * 5 * 10) / 10;
            categoryRatings.women_safety = Math.round((womenPercentage / 100) * 5 * 10) / 10;
        }

        // Add the new fields to the response
        trekData.average_rating = parseFloat(averageRating);
        trekData.total_reviews = totalReviews;
        trekData.rating_total = parseFloat(ratingTotal); // Sum of all rating values
        trekData.review_comments_count = reviewCommentsCount; // Count of reviews with content
        trekData.latest_reviews = latestReviews.map(review => ({
            customer_id: review.customer ? review.customer.id : null,
            customer_name: review.customer ? review.customer.name : 'Unknown',
            rating_value: parseFloat(review.rating_value),
            content: review.content || '',
            created_at: review.created_at || review.createdAt || null
        }));
        trekData.category_ratings = categoryRatings;

        // Add batch information if batch_id is provided
        if (batch_id) {
            try {
                console.log(`🔍 Fetching batch info for batch_id: ${batch_id}, trek_id: ${id}`);
                const batch = await Batch.findOne({
                    where: { 
                        id: batch_id,
                        trek_id: id 
                    },
                    attributes: ['id', 'tbr_id', 'start_date', 'end_date', 'booked_slots', 'available_slots', 'capacity']
                });
                
                console.log(`🔍 Batch query result:`, batch ? 'Found' : 'Not found');
                
                if (batch) {
                    trekData.batch_info = {
                        id: batch.id,
                        tbr_id: batch.tbr_id,
                        start_date: batch.start_date,
                        end_date: batch.end_date,
                        booked_slots: batch.booked_slots,
                        available_slots: batch.available_slots,
                        capacity: batch.capacity
                    };
                }
            } catch (batchError) {
                console.error("❌ Batch fetch error:", batchError);
            }
        }

        // Replace inclusion IDs with inclusion names (keeping ID and name)
        if (trekData.inclusions && Array.isArray(trekData.inclusions)) {
            try {
                const inclusionIds = trekData.inclusions.map(id => parseInt(id)).filter(id => !isNaN(id));
                if (inclusionIds.length > 0) {
                    const inclusions = await Inclusion.findAll({
                        where: { id: inclusionIds },
                        attributes: ['id', 'name', 'description']
                    });
                    
                    const inclusionMap = {};
                    inclusions.forEach(inc => {
                        inclusionMap[inc.id] = { id: inc.id, name: inc.name, description: inc.description };
                    });
                    
                    trekData.inclusions = trekData.inclusions.map(id => {
                        const numId = parseInt(id);
                        return inclusionMap[numId] || { id: numId, name: id }; // Return object with id and name
                    });
                }
            } catch (inclusionError) {
                console.log("Inclusion fetch error:", inclusionError.message);
            }
        }

        // Replace activity IDs with activity names - MOVED HERE FOR EARLIER EXECUTION
        console.log("🔍 ACTIVITIES DEBUG START - MOVED TO EARLIER POSITION");
        console.log("🔍 Raw activities field:", JSON.stringify(trekData.activities));
        
        if (trekData.activities && Array.isArray(trekData.activities)) {
            try {
                console.log("🔍 Processing activities array:", trekData.activities);
                const activityIds = trekData.activities.map(id => parseInt(id)).filter(id => !isNaN(id));
                console.log("🔍 Extracted IDs:", activityIds);
                
                if (activityIds.length > 0) {
                    console.log("🔍 Querying activities table for IDs:", activityIds);
                    const activities = await Activity.findAll({
                        where: { id: activityIds },
                        attributes: ['id', 'name']
                    });
                    
                    console.log("🔍 DB Query Result:", activities.length, "activities found");
                    activities.forEach(activity => {
                        console.log(`🔍 Activity ${activity.id}: ${activity.name}`);
                    });
                    
                    const activityMap = {};
                    activities.forEach(activity => {
                        activityMap[activity.id] = activity.name;
                    });
                    
                    console.log("🔍 Activity Map:", activityMap);
                    
                    // Force the transformation
                    trekData.activities = trekData.activities.map(id => {
                        const numId = parseInt(id);
                        const result = {
                            id: numId,
                            name: activityMap[numId] || `Activity ${id}`
                        };
                        console.log(`🔍 Mapping ${id} -> ${JSON.stringify(result)}`);
                        return result;
                    });
                    
                    console.log("🔍 FINAL RESULT:", JSON.stringify(trekData.activities));
                } else {
                    console.log("❌ No valid activity IDs found in array");
                }
            } catch (activityError) {
                console.log("❌ Activity fetch error:", activityError.message);
                console.log("❌ Error stack:", activityError.stack);
            }
        } else {
            console.log("❌ Activities field is not an array or doesn't exist");
        }
        console.log("🔍 ACTIVITIES DEBUG END");
        

        // Replace activity IDs with activity names in itinerary_items
        if (trekData.itinerary_items && Array.isArray(trekData.itinerary_items)) {
            try {
                // Collect all activity IDs from all itinerary items
                const allActivityIds = new Set();
                trekData.itinerary_items.forEach(item => {
                    if (item.activities && Array.isArray(item.activities)) {
                        item.activities.forEach(activityId => {
                            const numId = parseInt(activityId);
                            if (!isNaN(numId)) {
                                allActivityIds.add(numId);
                            }
                        });
                    }
                });

                if (allActivityIds.size > 0) {
                    const activities = await Activity.findAll({
                        where: { id: Array.from(allActivityIds) },
                        attributes: ['id', 'name', 'category_name']
                    });
                    
                    const activityMap = {};
                    activities.forEach(activity => {
                        activityMap[activity.id] = activity.name;
                    });
                    
                    // Replace activity IDs with names in each itinerary item
                    trekData.itinerary_items.forEach(item => {
                        if (item.activities && Array.isArray(item.activities)) {
                            item.activities = item.activities.map(activityId => {
                                const numId = parseInt(activityId);
                                return activityMap[numId] || activityId; // Return name if found, otherwise keep original ID
                            });
                        }
                    });
                }
            } catch (activityError) {
                console.log("Activity fetch error:", activityError.message);
            }
        }

        // Replace cancellation_policy_id with cancellation policy details
        if (trekData.cancellation_policy_id) {
            try {
                const cancellationPolicy = await CancellationPolicy.findOne({
                    where: { id: trekData.cancellation_policy_id },
                    attributes: ['id', 'title', 'description', 'rules', 'descriptionPoints']
                });
                
                if (cancellationPolicy) {
                    trekData.cancellation_policy = {
                        id: cancellationPolicy.id,
                        title: cancellationPolicy.title,
                        description: cancellationPolicy.description,
                        rules: cancellationPolicy.rules,
                        descriptionPoints: cancellationPolicy.descriptionPoints
                    };
                }
                // Remove the ID field since we now have the full policy object
                delete trekData.cancellation_policy_id;
            } catch (policyError) {
                console.log("Cancellation policy fetch error:", policyError.message);
            }
        }

        res.json({
            success: true,
            data: trekData
        });
        
    } catch (error) {
        console.error("Error fetching trek by ID:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch trek",
        });
    }
};

// Mobile: Get trek batches
exports.getTrekBatches = async (req, res) => {
    try {
        const { id } = req.params;

        // Verify trek exists, is active, and has been approved
        const trek = await Trek.findOne({
            where: { id: id, status: "active", trek_status: "approved" },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        const batches = await Batch.findAll({
            where: {
                trek_id: id,
                start_date: {
                    [Op.gte]: new Date(),
                },
            },
            order: [["start_date", "ASC"]],
        });

        const transformedBatches = batches.map((batch) => ({
            id: batch.id,
            trek_id: batch.trek_id,
            start_date: batch.start_date,
            end_date: batch.end_date,
            available_slots: batch.available_slots,
            total_slots: batch.total_slots,
            price: batch.price,
            status: batch.status,
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

// Mobile: Get trek reviews
exports.getTrekReviews = async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        // Verify trek exists
        const trek = await Trek.findByPk(id);
        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        const { count, rows: reviews } = await Review.findAndCountAll({
            where: { trek_id: id, is_approved: true },
            include: [
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name", "phone"],
                },
            ],
            order: [["created_at", "DESC"]],
            limit: parseInt(limit),
            offset: parseInt(offset),
        });

        res.json({
            success: true,
            data: reviews,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / limit),
                totalCount: count,
            },
        });
    } catch (error) {
        console.error("Error fetching trek reviews:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch trek reviews",
        });
    }
};

// Mobile: Get trek ratings
exports.getTrekRatings = async (req, res) => {
    try {
        const { id } = req.params;

        // Verify trek exists
        const trek = await Trek.findByPk(id);
        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        const ratings = await Rating.findAll({
            where: { trek_id: id },
            include: [
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name", "phone"],
                },
            ],
            order: [["created_at", "DESC"]],
        });

        res.json({
            success: true,
            data: ratings,
        });
    } catch (error) {
        console.error("Error fetching trek ratings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch trek ratings",
        });
    }
};