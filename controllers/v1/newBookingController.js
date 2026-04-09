const {
    Booking,
    Customer,
    Traveler,
    BookingTraveler,
    Trek,
    Vendor,
    Batch,
    PickupPoint,
    Coupon,
    City,
    Destination,
    Rating,
    TrekStage,
    RefundSettings,
    CancellationBooking,
    TrekCaptain,
    CancellationPolicy,
} = require("../../models");
const { Op } = require("sequelize");
const sequelize = require("../../models").sequelize;
const {
    updateBatchSlotsOnBooking,
    updateBatchSlotsOnCancellation,
} = require("../../utils/batchSlotManager");
const {
    roundHalfUp,
    calculateFlexibleRefund,
    calculateFlexibleRefundV2,
    calculateStandardRefund,
    determinePaymentStatus,
    calculateAdvanceAmount,
    getPolicySettings,
} = require("../../utils/refundCalculator");

// Create a new booking with travelers
exports.createBooking = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const {
            trek_id,
            batch_id,
            pickup_point_id,
            coupon_id,
            travelers, // Array of traveler objects
            special_requests,
            booking_source = "mobile",
        } = req.body;

        const customerId = req.customer.id;

        // Validate trek exists and is available
        const trek = await Trek.findByPk(trek_id, {
            include: [{ model: Vendor, as: "vendor" }],
        });

        if (!trek) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: "Trek not found",
            });
        }

        if (trek.status !== "active") {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: "Trek is not available for booking",
            });
        }

        // Validate batch if provided
        let batch = null;
        if (batch_id) {
            batch = await Batch.findOne({
                where: {
                    id: batch_id,
                    trek_id: trek_id,
                    status: "active",
                    start_date: { [Op.gte]: new Date() },
                },
            });

            if (!batch) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: "Batch not found or not available",
                });
            }
        }

        // Validate travelers data
        if (!travelers || !Array.isArray(travelers) || travelers.length === 0) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: "At least one traveler is required",
            });
        }

        // Process travelers - create or update existing ones
        const travelerIds = [];
        const processedTravelers = [];

        for (const travelerData of travelers) {
            let traveler;

            if (travelerData.id) {
                // Existing traveler - verify ownership
                traveler = await Traveler.findOne({
                    where: {
                        id: travelerData.id,
                        customer_id: customerId,
                        is_active: true,
                    },
                });

                if (!traveler) {
                    // Create new traveler if not found
                    traveler = await Traveler.create(
                        {
                            customer_id: customerId,
                            name: travelerData.name,
                            age: travelerData.age,
                            gender: travelerData.gender,
                        },
                        { transaction }
                    );
                }

                // Update traveler if needed
                await traveler.update(
                    {
                        name: travelerData.name || traveler.name,
                        age: travelerData.age || traveler.age,
                        gender: travelerData.gender || traveler.gender,
                    },
                    { transaction }
                );
            } else {
                // New traveler
                traveler = await Traveler.create(
                    {
                        customer_id: customerId,
                        name: travelerData.name,
                        age: travelerData.age,
                        gender: travelerData.gender,
                    },
                    { transaction }
                );
            }

            travelerIds.push(traveler.id);
            processedTravelers.push({
                traveler,
                is_primary: travelerData.is_primary || false,
                special_requirements: travelerData.special_requirements,
                accommodation_preference:
                    travelerData.accommodation_preference || "any",
                meal_preference: travelerData.meal_preference || "veg",
            });
        }

        // Ensure at least one primary traveler
        const hasPrimary = processedTravelers.some((t) => t.is_primary);
        if (!hasPrimary) {
            processedTravelers[0].is_primary = true;
        }

        // Calculate pricing
        const totalTravelers = travelers.length;
        const basePrice = trek.price_per_person;
        const totalAmount = basePrice * totalTravelers;

        // Apply coupon discount if provided
        let discountAmount = 0;
        let coupon = null;
        if (coupon_id) {
            coupon = await Coupon.findByPk(coupon_id);
            if (coupon && coupon.is_active) {
                if (coupon.discount_type === "percentage") {
                    discountAmount =
                        (totalAmount * coupon.discount_value) / 100;
                } else {
                    discountAmount = coupon.discount_value;
                }
            }
        }

        const finalAmount = Math.max(0, totalAmount - discountAmount);

        // Create booking
        const booking = await Booking.create(
            {
                customer_id: customerId,
                trek_id: trek_id,
                batch_id: batch_id,
                vendor_id: trek.vendor.id,
                pickup_point_id: pickup_point_id,
                coupon_id: coupon_id,
                total_travelers: totalTravelers,
                base_amount: totalAmount,
                discount_amount: discountAmount,
                final_amount: finalAmount,
                status: "pending",
                special_requests: special_requests,
                booking_source: booking_source,
            },
            { transaction }
        );

        // Create booking-traveler associations
        for (const processedTraveler of processedTravelers) {
            await BookingTraveler.create(
                {
                    booking_id: booking.id,
                    traveler_id: processedTraveler.traveler.id,
                    is_primary: processedTraveler.is_primary,
                    special_requirements:
                        processedTraveler.special_requirements,
                    accommodation_preference:
                        processedTraveler.accommodation_preference,
                    meal_preference: processedTraveler.meal_preference,
                    status: "confirmed",
                },
                { transaction }
            );
        }

        // Update batch slots if batch is specified
        if (batch) {
            await updateBatchSlotsOnBooking(
                batch.id,
                totalTravelers,
                transaction
            );
        }

        await transaction.commit();

        // Fetch booking with all related data
        const bookingWithDetails = await Booking.findByPk(booking.id, {
            include: [
                {
                    model: Trek,
                    as: "trek",
                    include: [{ model: Vendor, as: "vendor" }],
                },
                {
                    model: Batch,
                    as: "batch",
                },
                {
                    model: PickupPoint,
                    as: "pickupPoint",
                },
                {
                    model: Coupon,
                    as: "coupon",
                },
                {
                    model: BookingTraveler,
                    as: "bookingTravelers",
                    include: [{ model: Traveler, as: "traveler" }],
                },
            ],
        });

        res.status(201).json({
            success: true,
            message: "Booking created successfully",
            data: bookingWithDetails,
        });
    } catch (error) {
        await transaction.rollback();
        console.error("Error creating booking:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create booking",
        });
    }
};

// Helper function to calculate trek's overall rating from ratings
const calculateTrekRating = async (trekId) => {
    try {
        const ratings = await Rating.findAll({
            where: {
                trek_id: trekId,
                status: 'approved'
            },
        });

        if (ratings.length === 0) {
            return {
                overall: 0.0,
                ratingCount: 0,
            };
        }

        // Calculate overall average
        const totalRating = ratings.reduce((sum, rating) => sum + parseFloat(rating.rating_value), 0);
        const overall = parseFloat((totalRating / ratings.length).toFixed(2));

        return {
            overall,
            ratingCount: ratings.length,
        };
    } catch (error) {
        console.error("Error calculating trek rating:", error);
        return {
            overall: 0.0,
            ratingCount: 0,
        };
    }
};

// Get customer bookings with enhanced features
exports.getCustomerBookings = async (req, res) => {
    try {
        const customerId = req.customer.id;
        const { status, trek_status, page = 1, limit = 10 } = req.query;
        
        // Calculate pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;

        const whereClause = { customer_id: customerId };
        if (status && status !== "all") {
            whereClause.status = status;
        }

        // Get all bookings first (without pagination) to calculate trek_status
        const allBookings = await Booking.findAll({
            where: whereClause,
            include: [
                {
                    model: Trek,
                    as: "trek",
                    include: [
                        { 
                            model: Vendor, 
                            as: "vendor",
                            attributes: ["id", "company_info"]
                        },
                        {
                            model: Destination,
                            as: "destinationData",
                            attributes: ["id", "name"]
                        },
                        {
                            model: TrekCaptain,
                            as: "captain",
                            attributes: ["id", "name", "phone"]
                        }
                    ],
                },
                {
                    model: Batch,
                    as: "batch",
                    attributes: ["id", "tbr_id", "start_date", "end_date", "capacity", "booked_slots", "available_slots"]
                },
                {
                    model: City,
                    as: "city",
                    attributes: ["id", "cityName"]
                },
                {
                    model: BookingTraveler,
                    as: "travelers",
                    include: [{ model: Traveler, as: "traveler" }],
                },
            ],
            order: [["created_at", "DESC"]],
        });

        // Process bookings with enhanced data
        const processedBookings = await Promise.all(
            allBookings.map(async (booking) => {
                const bookingData = booking.toJSON();
                
                // Parse and format company_info if it exists
                if (bookingData.trek?.vendor?.company_info) {
                    try {
                        bookingData.trek.vendor.company_info = JSON.parse(bookingData.trek.vendor.company_info);
                    } catch (error) {
                        console.error('Error parsing company_info:', error);
                        bookingData.trek.vendor.company_info = null;
                    }
                }

                // Calculate trek rating
                const trekRating = await calculateTrekRating(bookingData.trek_id);
                bookingData.trek.rating = trekRating.overall;
                bookingData.trek.ratingCount = trekRating.ratingCount;

                // Add destination information
                if (bookingData.trek?.destinationData) {
                    bookingData.trek.destination = {
                        id: bookingData.trek.destinationData.id,
                        name: bookingData.trek.destinationData.name
                    };
                    delete bookingData.trek.destinationData;
                } else {
                    bookingData.trek.destination = null;
                }

                // Add captain information
                if (bookingData.trek?.captain) {
                    bookingData.trek.captain_name = bookingData.trek.captain.name;
                    bookingData.trek.captain_phone = bookingData.trek.captain.phone;
                    // Remove the nested captain object to avoid duplication
                    delete bookingData.trek.captain;
                } else {
                    bookingData.trek.captain_name = null;
                    bookingData.trek.captain_phone = null;
                }

                // Remove city_id from booking data
                delete bookingData.city_id;

                // Determine booking status based on date logic
                const currentDate = new Date();
                const bookingDate = new Date(bookingData.booking_date);
                const batchStartDate = bookingData.batch?.start_date ? new Date(bookingData.batch.start_date) : null;

                // Status logic: cancelled > completed (past date) > upcoming (future date)
                // Note: display_status field removed as per requirements

                // Add trek_status based on conditions
                let trek_status = "completed"; // default value

                // Condition 1: If booking status is cancelled
                if (bookingData.status === "cancelled") {
                    trek_status = "cancelled";
                }
                // Condition 2: Check batch start_date if available
                else if (bookingData.batch && bookingData.batch.start_date) {
                    const batchStartDate = new Date(bookingData.batch.start_date);
                    const currentDate = new Date();
                    
                    if (batchStartDate > currentDate) {
                        trek_status = "upcoming";
                    } else {
                        // Condition 3: Check trek_stages date_time using batch_id and stage_name = "return"
                        let trekStages = await TrekStage.findAll({
                            where: { 
                                trek_id: bookingData.trek_id,
                                batch_id: bookingData.batch_id,
                                stage_name: "return"
                            },
                            attributes: ["id", "stage_name", "date_time"],
                            order: [["date_time", "ASC"]]
                        });
                        
                        // If no stages found with batch_id, try without batch_id filter
                        if (trekStages.length === 0) {
                            trekStages = await TrekStage.findAll({
                                where: { 
                                    trek_id: bookingData.trek_id,
                                    stage_name: "return"
                                },
                                attributes: ["id", "stage_name", "date_time"],
                                order: [["date_time", "ASC"]]
                            });
                        }
                        
                        if (trekStages && trekStages.length > 0) {
                            const firstStage = trekStages[0];
                            
                            // Add date_time field to API response for 3rd condition
                            bookingData.trek_stage_date_time = firstStage.date_time;
                            bookingData.trek_stage_name = firstStage.stage_name;
                            
                            if (firstStage.date_time) {
                                // Parse the date string properly
                                let stageDate;
                                try {
                                    // Handle different date formats
                                    const dateStr = firstStage.date_time;
                                    
                                    // Try parsing as is first
                                    stageDate = new Date(dateStr);
                                    
                                    // If invalid, try to parse with different formats
                                    if (isNaN(stageDate.getTime())) {
                                        // Try parsing with different format
                                        const parts = dateStr.split(' ');
                                        if (parts.length >= 2) {
                                            const datePart = parts[0];
                                            const timePart = parts[1] + (parts[2] ? ' ' + parts[2] : '');
                                            stageDate = new Date(`${datePart}T${timePart}`);
                                        }
                                    }
                                } catch (error) {
                                    stageDate = new Date(firstStage.date_time);
                                }
                                
                                const currentDate = new Date();
                                
                                if (stageDate > currentDate) {
                                    trek_status = "ongoing";
                                } else {
                                    trek_status = "completed";
                                }
                            }
                        }
                    }
                }
                // Condition 3: If no batch, check trek_stages directly
                else {
                    const trekStages = await TrekStage.findAll({
                        where: { trek_id: bookingData.trek_id },
                        attributes: ["id", "stage_name", "date_time"],
                        order: [["date_time", "ASC"]]
                    });
                    
                    if (trekStages && trekStages.length > 0) {
                        const firstStage = trekStages[0];
                        if (firstStage.date_time) {
                            const stageDate = new Date(firstStage.date_time);
                            const currentDate = new Date();
                            
                            if (stageDate > currentDate) {
                                trek_status = "ongoing";
                            } else {
                                trek_status = "completed";
                            }
                        }
                    }
                }

                // Add trek_status to the response
                bookingData.trek_status = trek_status;

                // Add individual booking slots (this is what should be displayed in mobile app)
                // Instead of showing batch.booked_slots (total for batch), show this booking's total_travelers
                bookingData.individual_booked_slots = bookingData.total_travelers;

                // Modify batch object to show individual booking slots instead of batch total
                if (bookingData.batch) {
                    // Store original batch booked_slots for reference
                    bookingData.batch.total_batch_booked_slots = bookingData.batch.booked_slots;
                    // Replace with individual booking slots for display
                    bookingData.batch.booked_slots = bookingData.total_travelers;
                }

                // Add rating information - check for rating with booking_id, customer_id, and trek_id
                try {
                    console.log(`🔍 Looking for rating with:`, {
                        booking_id: bookingData.id,
                        customer_id: bookingData.customer_id,
                        trek_id: bookingData.trek_id
                    });
                    
                    const rating = await Rating.findOne({
                        where: {
                            booking_id: bookingData.id,
                            customer_id: bookingData.customer_id,
                            trek_id: bookingData.trek_id
                        },
                        attributes: ['id', 'rating_value', 'content']
                    });
                    
                    console.log(`🔍 Rating query result:`, rating ? 'Found' : 'Not found');
                    if (rating) {
                        console.log(`🔍 Rating details:`, rating.toJSON());
                    }
                    
                    if (rating && rating.rating_value !== null && rating.rating_value !== undefined) {
                        bookingData.rating_given = true;
                        bookingData.rating_value = parseFloat(rating.rating_value);
                        console.log(`✅ Rating found: ${bookingData.rating_value}`);
                    } else {
                        bookingData.rating_given = false;
                        bookingData.rating_value = null;
                        console.log(`❌ No rating found`);
                    }
                } catch (ratingError) {
                    console.error('Error fetching rating:', ratingError);
                    bookingData.rating_given = false;
                    bookingData.rating_value = null;
                }

                return bookingData;
            })
        );

        // Filter by trek_status if provided
        let filteredBookings = processedBookings;
        if (trek_status && trek_status !== "all") {
            filteredBookings = processedBookings.filter(booking => 
                booking.trek_status === trek_status
            );
        }

        // Apply pagination to filtered results
        const totalCount = filteredBookings.length;
        const startIndex = offset;
        const endIndex = startIndex + limitNum;
        const paginatedBookings = filteredBookings.slice(startIndex, endIndex);

        // Calculate pagination info
        const totalPages = Math.ceil(totalCount / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;

        res.json({
            success: true,
            data: paginatedBookings,
            pagination: {
                currentPage: pageNum,
                totalPages: totalPages,
                totalCount: totalCount,
                limit: limitNum,
                hasNextPage: hasNextPage,
                hasPrevPage: hasPrevPage,
                nextPage: hasNextPage ? pageNum + 1 : null,
                prevPage: hasPrevPage ? pageNum - 1 : null
            },
            count: paginatedBookings.length,
        });
    } catch (error) {
        console.error("Error fetching customer bookings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch bookings",
        });
    }
};

// Get booking details
exports.getBookingDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const customerId = req.customer.id;

        const booking = await Booking.findOne({
            where: { id: id, customer_id: customerId },
            include: [
                {
                    model: Trek,
                    as: "trek",
                    include: [
                        { model: Vendor, as: "vendor" },
                        {
                            model: TrekCaptain,
                            as: "captain",
                            attributes: ["id", "name", "phone"]
                        }
                    ],
                },
                {
                    model: Batch,
                    as: "batch",
                },
                {
                    model: Coupon,
                    as: "coupon",
                },
                {
                    model: BookingTraveler,
                    as: "travelers",
                    include: [{ model: Traveler, as: "traveler" }],
                },
            ],
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        // Format the response to parse company_info
        const bookingData = booking.toJSON();
        
        // Parse and format company_info if it exists
        if (bookingData.trek?.vendor?.company_info) {
            try {
                bookingData.trek.vendor.company_info = JSON.parse(bookingData.trek.vendor.company_info);
            } catch (error) {
                console.error('Error parsing company_info:', error);
                bookingData.trek.vendor.company_info = null;
            }
        }

        // Add captain information
        if (bookingData.trek?.captain) {
            bookingData.trek.captain_name = bookingData.trek.captain.name;
            bookingData.trek.captain_phone = bookingData.trek.captain.phone;
            // Remove the nested captain object to avoid duplication
            delete bookingData.trek.captain;
        } else {
            bookingData.trek.captain_name = null;
            bookingData.trek.captain_phone = null;
        }

        // Add individual booking slots (this is what should be displayed in mobile app)
        // Instead of showing batch.booked_slots (total for batch), show this booking's total_travelers
        bookingData.individual_booked_slots = bookingData.total_travelers;

        // Modify batch object to show individual booking slots instead of batch total
        if (bookingData.batch) {
            // Store original batch booked_slots for reference
            bookingData.batch.total_batch_booked_slots = bookingData.batch.booked_slots;
            // Replace with individual booking slots for display
            bookingData.batch.booked_slots = bookingData.total_travelers;
        }

        res.json({
            success: true,
            data: bookingData,
        });
    } catch (error) {
        console.error("Error fetching booking details:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch booking details",
        });
    }
};

// Cancel booking
exports.cancelBooking = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { id } = req.params;
        const customerId = req.customer.id;

        const booking = await Booking.findOne({
            where: { id: id, customer_id: customerId },
            include: [{ model: Batch, as: "batch" }],
        });

        if (!booking) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        if (booking.status === "cancelled") {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: "Booking is already cancelled",
            });
        }

        if (booking.status === "completed") {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: "Cannot cancel completed booking",
            });
        }

        // Block customer from cancelling an ongoing trek
        if (booking.batch) {
            const now = new Date();
            const batchStart = new Date(booking.batch.start_date);
            const batchEnd = new Date(booking.batch.end_date);
            if (batchStart <= now && now <= batchEnd) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "Cannot cancel a trek that is currently ongoing. Please contact support.",
                });
            }
        }

        // Update booking status
        await booking.update({ status: "cancelled" }, { transaction });

        // Update batch slots if batch exists
        if (booking.batch) {
            await updateBatchSlotsOnCancellation(
                booking.batch.id,
                booking.total_travelers,
                transaction
            );
        }

        await transaction.commit();

        res.json({
            success: true,
            message: "Booking cancelled successfully",
        });
    } catch (error) {
        await transaction.rollback();
        console.error("Error cancelling booking:", error);
        res.status(500).json({
            success: false,
            message: "Failed to cancel booking",
        });
    }
};

// Get cancellation refund details
exports.getCancellationRefundDetails = async (req, res) => {
    try {
        const { booking_id } = req.params;
        const customerId = req.customer.id;

        // Find the booking with related data including trek with cancellation_policy_id
        const booking = await Booking.findOne({
            where: { 
                id: booking_id, 
                customer_id: customerId 
            },
            include: [
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name", "email", "phone"]
                },
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "base_price", "cancellation_policy_id"],
                    include: [{
                        model: CancellationPolicy,
                        as: "cancellation_policy",
                        attributes: ["id", "title", "description"]
                    }]
                },
                {
                    model: Batch,
                    as: "batch",
                    attributes: ["id", "tbr_id", "start_date", "end_date"]
                }
            ]
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        // Check if booking is already cancelled
        if (booking.status === "cancelled") {
            return res.status(409).json({
                success: false,
                message: "Booking is already cancelled",
                error: "Already cancelled"
            });
        }

        const currentDate = new Date();
        
        // Get policy details from trek
        const policyId = booking.trek?.cancellation_policy_id;
        const policyName = booking.trek?.cancellation_policy?.title || null;
        
        // Determine policy type from policy name (check if it contains "flexible")
        // If policy is null or doesn't contain "flexible", default to standard
        let policyType = "standard";
        if (policyName && policyName.toLowerCase().includes("flexible")) {
            policyType = "flexible";
        } else if (policyName && policyName.toLowerCase().includes("standard")) {
            policyType = "standard";
        }
        
        // Fallback to booking's cancellation_policy_type if policy from trek is not available
        if (!policyName) {
            policyType = booking.cancellation_policy_type || "standard";
        }
        
        console.log("🔍 Policy Details:", {
            policyId: policyId,
            policyName: policyName,
            policyType: policyType,
            bookingPolicyType: booking.cancellation_policy_type
        });

        // Find boarding point datetime from trek_stages
        let boardingDateTime = null;
        let timeRemainingHours = 0;
        let canCancel = true;
        let cancellationMessage = null;
        
        if (booking.trek_id && booking.batch_id) {
            const boardingStage = await TrekStage.findOne({
                where: {
                    trek_id: booking.trek_id,
                    batch_id: booking.batch_id,
                    is_boarding_point: true
                },
                attributes: ["id", "stage_name", "date_time"]
            });

            if (boardingStage && boardingStage.date_time) {
                boardingDateTime = new Date(boardingStage.date_time);
                timeRemainingHours = Math.max(0, (boardingDateTime.getTime() - currentDate.getTime()) / (1000 * 60 * 60));
                
                console.log("🔍 Boarding Time Calculation:", {
                    boardingDateTime: boardingDateTime.toISOString(),
                    currentDateTime: currentDate.toISOString(),
                    timeRemainingHours: timeRemainingHours
                });
            }
        }

        // Get booking amount fields
        const finalAmount = parseFloat(booking.final_amount || 0);
        const platformFees = parseFloat(booking.platform_fees || 0);
        const gstAmount = parseFloat(booking.gst_amount || 0);
        const insuranceAmount = parseFloat(booking.insurance_amount || 0);
        const freeCancellationAmount = parseFloat(booking.free_cancellation_amount || 0);
        const advanceAmount = parseFloat(booking.advance_amount || 0);
        
        // Determine if free cancellation is available
        const hasFreeCancellation = freeCancellationAmount > 0;

        let refundCalculation = null;

        // Apply different logic based on policy type
        if (policyType === "flexible") {
            refundCalculation = calculateFlexibleRefundV2({
                finalAmount,
                platformFees,
                gstAmount,
                insuranceAmount,
                freeCancellationAmount,
                advanceAmount,
                hasFreeCancellation,
                timeRemainingHours,
                bookingId: booking.id,
                policyName,
                totalTravelers: booking.total_travelers
            });

            // Check if cancellation is allowed
            if (timeRemainingHours <= 0) {
                canCancel = false;
                cancellationMessage = "Trek has already started or completed - no refund available";
            } else if (timeRemainingHours > 24) {
                canCancel = true;
                cancellationMessage = null;
            } else if (timeRemainingHours <= 24) {
                canCancel = true;
                cancellationMessage = "Cancellation within 24 hours - limited refund as per policy";
            }

        } else if (policyType === "standard") {
            // Use standard policy calculation
            const policySettings = await getPolicySettings(require("../../models"), policyType);
            const batchStartDate = booking.batch ? new Date(booking.batch.start_date) : null;
            
            if (!batchStartDate) {
                canCancel = false;
                cancellationMessage = "No batch start date found, cannot calculate refund";
            } else {
                refundCalculation = calculateStandardRefund({
                    trekPrice: finalAmount,
                    trekStartDatetime: batchStartDate,
                    cancellationTime: currentDate,
                    bookingStatus: booking.status,
                    policySettings: policySettings
                });

                // Check if cancellation is allowed
                if (refundCalculation.error) {
                    canCancel = false;
                    cancellationMessage = refundCalculation.error;
                } else if (refundCalculation.time_remaining_hours <= 0) {
                    canCancel = false;
                    cancellationMessage = "Trek has already started, cannot cancel booking";
                }
            }
        }

        // Format the response
        const response = {
            success: true,
            data: {
                booking_id: booking.id,
                trek_id: booking.trek_id,
                batch_id: booking.batch_id,
                customer_id: booking.customer_id,
                customer_name: booking.customer.name,
                final_amount: finalAmount,
                advance_amount: advanceAmount,
                cancellation_policy_id: policyId,
                cancellation_policy_name: policyName,
                cancellation_policy_type: policyType,
                current_date: currentDate.toISOString(),
                boarding_date_time: boardingDateTime ? boardingDateTime.toISOString() : null,
                time_remaining_hours: timeRemainingHours,
                can_cancel: canCancel,
                cancellation_message: cancellationMessage,
                refund_calculation: refundCalculation,
                trek_details: {
                    id: booking.trek.id,
                    title: booking.trek.title,
                    base_price: booking.trek.base_price
                },
                batch_details: booking.batch ? {
                    id: booking.batch.id,
                    tbr_id: booking.batch.tbr_id,
                    start_date: booking.batch.start_date,
                    end_date: booking.batch.end_date
                } : null
            }
        };

        res.json(response);
    } catch (error) {
        console.error("❌ Error fetching cancellation refund details:", error);
        console.error("❌ Error stack:", error.stack);
        res.status(500).json({
            success: false,
            message: "Failed to fetch cancellation refund details",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// Confirm cancellation and create cancellation record
exports.confirmCancellation = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { booking_id, total_refundable_amount, reason, deduction } = req.body;
        const customerId = req.customer.id;

        // Validate required fields
        if (!booking_id || !total_refundable_amount) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: "booking_id and total_refundable_amount are required",
            });
        }

        // Find the booking and verify ownership
        // Include vendor_discount and coupon_discount from booking, and base_price from trek
        const booking = await Booking.findOne({
            where: { 
                id: booking_id, 
                customer_id: customerId 
            },
            include: [
                {
                    model: Batch,
                    as: "batch"
                },
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "base_price", "mtr_id"]
                }
            ],
            attributes: [
                "id",
                "customer_id",
                "trek_id",
                "batch_id",
                "total_travelers",
                "vendor_discount",
                "coupon_discount",
                "status"
            ]
        });

        if (!booking) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: "Booking not found or you don't have permission to cancel it",
            });
        }

        // Check if booking is already cancelled
        if (booking.status === "cancelled") {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: "Booking is already cancelled",
            });
        }

        // Check if booking is completed
        if (booking.status === "completed") {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: "Cannot cancel completed booking",
            });
        }

        // Block customer from cancelling an ongoing trek
        if (booking.batch) {
            const now = new Date();
            const batchStart = new Date(booking.batch.start_date);
            const batchEnd = new Date(booking.batch.end_date);
            if (batchStart <= now && now <= batchEnd) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "Cannot cancel a trek that is currently ongoing. Please contact support.",
                });
            }
        }

        // Check if cancellation already exists for this booking
        const existingCancellation = await CancellationBooking.findOne({
            where: { booking_id: booking_id }
        });

        if (existingCancellation) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: "Cancellation already exists for this booking",
            });
        }

        // Calculate deduction amounts using the proper formula
        // Get values from booking and trek
        const basePrice = parseFloat(booking.trek?.base_price || 0);
        const vendorDiscount = parseFloat(booking.vendor_discount || 0);
        const couponDiscount = parseFloat(booking.coupon_discount || 0);
        const totalTravelers = parseInt(booking.total_travelers || 1);
        const totalRefundableAmount = parseFloat(total_refundable_amount || 0);

        // Step 1: Calculate basic_amount
        // basic_amount = (base_price - vendor_discount - coupon_discount) * total_travelers
        const basicAmount = (basePrice - vendorDiscount - couponDiscount) * totalTravelers;

        // Step 2: Calculate gst_refund_amount
        // gst_refund_amount = total_refundable_amount * 5%
        const gstRefundAmount = totalRefundableAmount * 0.05;

        // Step 3: Calculate comi_base_amount
        // comi_base_amount = basic_amount * 10%
        const comiBaseAmount = basicAmount * 0.10;

        // Step 4: Calculate final_base_amount
        // final_base_amount = comi_base_amount * 18%
        const finalBaseAmount = comiBaseAmount * 0.18;

        // Step 5: Calculate tcs_base_amount
        // tcs_base_amount = basic_amount * 1%
        const tcsBaseAmount = basicAmount * 0.01;

        // Step 6: Calculate final_payback_amount
        // final_payback_amount = total_refundable_amount - gst_refund_amount - comi_base_amount - final_base_amount - tcs_base_amount
        const finalPaybackAmount = totalRefundableAmount - gstRefundAmount - comiBaseAmount - finalBaseAmount - tcsBaseAmount;

        // Both deduction_admin and deduction_vendor should store the final_payback_amount
        const deductionAdmin = finalPaybackAmount;
        const deductionVendor = finalPaybackAmount;
        const deductionAmount = finalPaybackAmount; // Keep for backward compatibility

        console.log("🔍 Cancellation deduction calculations:");
        console.log("- base_price:", basePrice);
        console.log("- vendor_discount:", vendorDiscount);
        console.log("- coupon_discount:", couponDiscount);
        console.log("- total_travelers:", totalTravelers);
        console.log("- basic_amount:", basicAmount);
        console.log("- total_refundable_amount:", totalRefundableAmount);
        console.log("- gst_refund_amount (5%):", gstRefundAmount);
        console.log("- comi_base_amount (10%):", comiBaseAmount);
        console.log("- final_base_amount (18%):", finalBaseAmount);
        console.log("- tcs_base_amount (1%):", tcsBaseAmount);
        console.log("- final_payback_amount:", finalPaybackAmount);
        console.log("- deduction_admin:", deductionAdmin);
        console.log("- deduction_vendor:", deductionVendor);

        // Cap refund to amount actually paid
        const maxRefundable = parseFloat(booking.final_amount || 0);
        if (totalRefundableAmount > maxRefundable) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Refund amount (${totalRefundableAmount}) cannot exceed total paid amount (${maxRefundable})`,
            });
        }

        // Create cancellation record
        const cancellationRecord = await CancellationBooking.create({
            booking_id: booking_id,
            customer_id: customerId,
            trek_id: booking.trek_id,
            batch_id: booking.batch_id,
            total_refundable_amount: totalRefundableAmount,
            deduction: deductionAmount,
            deduction_admin: deductionAdmin,
            deduction_vendor: deductionVendor,
            status: "confirmed",
            reason: reason || null,
            cancellation_date: new Date()
        }, { transaction });

        // Update booking status to cancelled
        await booking.update({ 
            status: "cancelled" 
        }, { transaction });

        // Update batch slots if batch exists
        if (booking.batch) {
            await updateBatchSlotsOnCancellation(
                booking.batch.id,
                booking.total_travelers,
                transaction
            );
        }


        await transaction.commit();

        res.status(201).json({
            success: true,
            message: "Booking cancelled successfully",
            data: {
                cancellation_id: cancellationRecord.id,
                booking_id: booking_id,
                status: "confirmed",
                total_refundable_amount: parseFloat(total_refundable_amount),
                deduction: deductionAmount,
                deduction_admin: deductionAdmin,
                deduction_vendor: deductionVendor,
                cancellation_date: cancellationRecord.cancellation_date,
                trek_details: {
                    id: booking.trek.id,
                    title: booking.trek.title,
                    base_price: booking.trek.base_price,
                    mtr_id: booking.trek.mtr_id
                },
                batch_details: booking.batch ? {
                    id: booking.batch.id,
                    tbr_id: booking.batch.tbr_id,
                    start_date: booking.batch.start_date,
                    end_date: booking.batch.end_date
                } : null
            }
        });

    } catch (error) {
        await transaction.rollback();
        console.error("❌ Error confirming cancellation:", error);
        console.error("❌ Error stack:", error.stack);
        res.status(500).json({
            success: false,
            message: "Failed to confirm cancellation",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};
