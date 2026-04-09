const {
    Booking,
    BookingTraveler,
    Trek,
    Customer,
    Vendor,
    Coupon,
    PaymentLog,
    Batch,
    Destination,
    City,
    sequelize,
    Traveler,
    TrekStage,
    Rating,
    PaymentFailed,
} = require("../../models");
const logger = require("../../utils/logger");
const { Op } = require("sequelize");
const CouponAuditService = require("../../services/couponAuditService");
const {
    createRazorpayOrder,
    verifyRazorpaySignature,
    getPaymentDetails,
    getOrderDetails,
} = require("../../utils/razorpayUtils");
const {
    updateBatchSlotsOnBooking,
    updateBatchSlotsOnCancellation,
} = require("../../utils/batchSlotManager");

// Mobile: Get customer bookings
exports.getCustomerBookings = async (req, res) => {
    try {
        const customerId = req.customer.id;
        const { page = 1, limit = 10, status = "" } = req.query;
        const offset = (page - 1) * limit;

        if (!customerId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Customer account required.",
            });
        }

        const whereClause = { customer_id: customerId };
        if (status && status !== "all") {
            whereClause.status = status;
        }

        const { count, rows: bookings } = await Booking.findAndCountAll({
            where: whereClause,
            include: [
                { model: Trek, as: "trek" },
                { model: Vendor, as: "vendor" },
                {
                    model: BookingTraveler,
                    as: "travelers",
                    include: [{ model: Traveler, as: "traveler" }],
                },
                { model: PaymentLog, as: "payments" },
                { 
                    model: Batch, 
                    as: "batch",
                    required: false,
                    attributes: ["id", "start_date", "end_date"]
                },
            ],
            order: [["created_at", "DESC"]],
            limit: parseInt(limit),
            offset: parseInt(offset),
        });

        // Format the response to parse company_info and add trek_status
        const formattedBookings = [];
        
        for (const booking of bookings) {
            const bookingData = booking.toJSON();

            if (bookingData.trek?.vendor?.company_info) {
                try {
                    bookingData.trek.vendor.company_info = JSON.parse(bookingData.trek.vendor.company_info);
                } catch (_) {
                    bookingData.trek.vendor.company_info = null;
                }
            }

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
                    // Condition 3: Check trek_stages date_time
                    const trekStages = await TrekStage.findAll({
                        where: { trek_id: bookingData.trek_id },
                        attributes: ["id", "stage_name", "date_time"],
                        order: [["date_time", "ASC"]]
                    });
                    
                    if (trekStages && trekStages.length > 0) {
                        const firstStage = trekStages[0];
                        if (firstStage.date_time) {
                            const stageDate = new Date(firstStage.date_time);
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
            
            // Add rating information
            try {
                if (Rating) {
                    const rating = await Rating.findOne({
                        where: {
                            customer_id: bookingData.customer_id,
                            trek_id: bookingData.trek_id
                        },
                        attributes: ['rating_value']
                    });
                    bookingData.rating_given = !!(rating && rating.rating_value);
                    bookingData.rating_value = rating?.rating_value ? parseFloat(rating.rating_value) : null;
                } else {
                    bookingData.rating_given = false;
                    bookingData.rating_value = null;
                }
            } catch (_) {
                bookingData.rating_given = false;
                bookingData.rating_value = null;
            }
            formattedBookings.push(bookingData);
        }

        res.json({
            success: true,
            data: formattedBookings,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / limit),
                totalCount: count,
            },
        });
    } catch (error) {
        logger.error('booking', 'Error fetching customer bookings', { error: error.message, customer_id: req.customer?.id });
        res.status(500).json({ success: false, message: "Failed to fetch bookings" });
    }
};

// Mobile: Get booking by ID
exports.getBookingById = async (req, res) => {
    try {
        const { id } = req.params;
        const customerId = req.customer.id;

        if (!customerId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Customer account required.",
            });
        }

        const booking = await Booking.findOne({
            where: { id, customer_id: customerId },
            include: [
                { model: Trek, as: "trek" },
                { model: Vendor, as: "vendor" },
                {
                    model: BookingTraveler,
                    as: "travelers",
                    include: [{ model: Traveler, as: "traveler" }],
                },
                { model: PaymentLog, as: "payments" },
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

        res.json({
            success: true,
            data: bookingData,
        });
    } catch (error) {
        console.error("Error fetching booking by ID:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch booking",
        });
    }
};

// Mobile: Create booking
exports.createBooking = async (req, res) => {
    try {
        const {
            trekId,
            batchId,
            travelers,
            specialRequests,
            couponCode,
        } = req.body;
        const customerId = req.customer.id;

        if (!customerId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Customer account required.",
            });
        }

        // Validate trek exists and is active
        const trek = await Trek.findOne({
            where: { id: trekId, status: "active" },
            include: [{ model: Vendor, as: "vendor" }],
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found or inactive",
            });
        }

        // Validate batch exists and belongs to the trek
        const batch = await Batch.findOne({
            where: { id: batchId, trek_id: trekId },
        });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: "Batch not found",
            });
        }

        // Check if batch has enough available slots
        const availableSlots =
            batch.available_slots || batch.capacity - (batch.booked_slots || 0);
        if (availableSlots < travelers.length) {
            // Record a failed booking attempt with payment verified if we have finalAmount > 0
            try {
                await Booking.create({
                    customer_id: customerId,
                    trek_id: trekId,
                    batch_id: batchId,
                    vendor_id: trek.vendor_id,
                    total_travelers: travelers.length,
                    total_amount: trek.base_price * travelers.length,
                    discount_amount: 0,
                    final_amount: typeof finalAmount === 'number' ? finalAmount : trek.base_price * travelers.length,
                    payment_status: 'failed',
                    status: 'pending',
                    booking_date: new Date(),
                    // payment_failed: true, // TODO: Uncomment after adding column to database
                    payment_issue_reason: 'capacity_exhausted',
                });
            } catch (auditError) {
                console.error('Audit save failed (payment but booking failed):', auditError.message);
            }
            return res.status(400).json({
                success: false,
                message: `Not enough slots available. Available: ${availableSlots}, Requested: ${travelers.length}`,
            });
        }

        // Calculate pricing
        const participantCount = travelers.length;
        const totalAmount = trek.base_price * participantCount;
        let finalAmount = totalAmount;
        let discountAmount = 0;

        // Apply coupon if provided
        if (couponCode) {
            const coupon = await Coupon.findOne({
                where: { code: couponCode, status: "active" },
            });

            if (coupon) {
                discountAmount =
                    (totalAmount * coupon.discount_percentage) / 100;
                finalAmount = totalAmount - discountAmount;
            }
        }

        // Create booking
        const booking = await Booking.create({
            customer_id: customerId,
            trek_id: trekId,
            batch_id: batchId,
            vendor_id: trek.vendor_id,
            total_travelers: participantCount,
            total_amount: totalAmount,
            discount_amount: discountAmount,
            final_amount: finalAmount,
            status: "pending",
            payment_status: "pending",
            booking_date: new Date(),
            special_requests: specialRequests,
        });

        // Create travelers
        const travelerPromises = travelers.map(async (travelerData, index) => {
            // Create or find traveler
            let traveler = await Traveler.findOne({
                where: {
                    name: travelerData.name,
                    age: travelerData.age,
                    gender: travelerData.gender,
                    customer_id: customerId,
                },
            });

            if (!traveler) {
                traveler = await Traveler.create({
                    customer_id: customerId,
                    name: travelerData.name,
                    age: travelerData.age,
                    gender: travelerData.gender,
                });
            }

            // Create booking traveler relationship
            return BookingTraveler.create({
                booking_id: booking.id,
                traveler_id: traveler.id,
                is_primary: index === 0,
                status: "confirmed",
            });
        });

        await Promise.all(travelerPromises);

        // Update batch slots
        try {
            await updateBatchSlotsOnBooking(batchId, travelers.length);
        } catch (slotError) {
            console.error("Error updating batch slots:", slotError);
        }

        // Fetch complete booking data
        const completeBooking = await Booking.findByPk(booking.id, {
            include: [
                { model: Trek, as: "trek" },
                { model: Vendor, as: "vendor" },
                {
                    model: BookingTraveler,
                    as: "travelers",
                    include: [{ model: Traveler, as: "traveler" }],
                },
            ],
        });

        res.status(201).json({
            success: true,
            message: "Booking created successfully",
            data: completeBooking,
        });
    } catch (error) {
        console.error("Error creating booking:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create booking",
        });
    }
};

// Mobile: Create Razorpay order
exports.createOrder = async (req, res) => {
    try {
        const {
            trekId,
            batchId,
            travelers,
            finalAmount,
            couponCode,
            remaining_amount,
        } = req.body;
        const customerId = req.customer.id;

        if (!customerId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Customer account required.",
            });
        }

        // Validate required fields
        if (!trekId || !batchId || !travelers || travelers.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Trek ID, batch ID, and travelers are required",
            });
        }

        // Validate trek exists and is active
        const trek = await Trek.findOne({
            where: { id: trekId, status: "active" },
        });

        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found or inactive",
            });
        }

        // Validate batch
        const batch = await Batch.findOne({
            where: { id: batchId, trek_id: trekId },
        });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: "Batch not found",
            });
        }

        // Check available slots
        const availableSlots =
            batch.available_slots || batch.capacity - (batch.booked_slots || 0);
        if (availableSlots < travelers.length) {
            return res.status(400).json({
                success: false,
                message: `Not enough slots available. Available: ${availableSlots}, Requested: ${travelers.length}`,
            });
        }

        // Server-side amount validation: client-supplied finalAmount must be positive
        if (!finalAmount || isNaN(finalAmount) || parseFloat(finalAmount) <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment amount",
            });
        }

        // Create Razorpay order
        const orderResponse = await createRazorpayOrder(
            parseFloat(finalAmount),
            "INR",
            `trek_${trekId}_${Date.now()}`
        );

        if (!orderResponse.success) {
            return res.status(500).json({
                success: false,
                message: "Failed to create payment order",
            });
        }

        res.json({
            success: true,
            message: "Order created successfully",
            order: orderResponse.order,
            remaining_amount: parseFloat(remaining_amount || 0).toFixed(2),
        });
    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create order",
        });
    }
};

// Mobile: Verify payment and create booking
exports.verifyPayment = async (req, res) => {
    try {
        const {
            orderId,
            paymentId,
            signature,
            trekId,
            batchId,
            travelers,
            cityId,
            specialRequests,
            isPartialAmount,
            fareBreakup,
        } = req.body;
        const customerId = req.customer.id;

        if (!customerId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Customer account required.",
            });
        }

        // Validate required fields
        if (!orderId || !paymentId || !signature) {
            return res.status(400).json({
                success: false,
                message: "Order ID, payment ID, and signature are required",
            });
        }

        // Idempotency: reject if payment_id already processed
        const existingPayment = await PaymentLog.findOne({ where: { transaction_id: paymentId } });
        if (existingPayment) {
            return res.status(409).json({
                success: false,
                message: "Payment already processed",
                booking_id: existingPayment.booking_id,
            });
        }

        // Verify Razorpay signature
        const isSignatureValid = verifyRazorpaySignature(orderId, paymentId, signature);
        if (!isSignatureValid) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment signature",
            });
        }

        // Get payment details from Razorpay
        const paymentResult = await getPaymentDetails(paymentId);
        if (!paymentResult.success) {
            return res.status(400).json({
                success: false,
                message: "Failed to verify payment",
            });
        }

        const payment = paymentResult.payment;

        // Verify payment status
        if (payment.status !== "captured") {
            return res.status(400).json({
                success: false,
                message: "Payment not completed",
            });
        }

        // Verify payment amount against the Razorpay ORDER (server-authoritative), not client fareBreakup
        const orderResult = await getOrderDetails(orderId);
        const expectedAmount = orderResult.success ? orderResult.order.amount : Math.round((fareBreakup.finalAmount || 0) * 100);
        if (payment.amount !== expectedAmount) {
            const errorMessage = `Payment amount mismatch. Expected: ${expectedAmount}, Received: ${payment.amount}`;
            
            // Save failed payment data to PaymentFailed table
            try {
                await PaymentFailed.create({
                    order_id: orderId || null,
                    payment_id: paymentId || null,
                    signature: signature || null,
                    batch_id: batchId || null,
                    customer_id: customerId || null,
                    total_travelers: travelers?.length || 0,
                    total_amount: fareBreakup?.totalBasicCost || null,
                    final_amount: fareBreakup?.finalAmount || null,
                    coupon_id: fareBreakup?.couponId || null,
                    payment_status: "failed",
                    request_data: req.body,
                    error_message: errorMessage,
                    error_type: "AMOUNT_MISMATCH",
                    available_slots: null,
                    requested_slots: travelers?.length || 0,
                    payment_failed: true
                });
                
                logger.info('payment', 'Payment failed saved: amount mismatch', { order_id: orderId });
            } catch (saveError) {
                logger.error('payment', 'Failed to save payment failed record', { error: saveError.message });
            }
            
            return res.status(400).json({
                success: false,
                message: "Payment amount mismatch",
            });
        }

        // Get trek details
        const trek = await Trek.findOne({
            where: { id: trekId, status: "active" },
        });

        if (!trek) {
            const errorMessage = `Trek not found or inactive. Trek ID: ${trekId}`;
            
            // Save failed payment data to PaymentFailed table
            try {
                await PaymentFailed.create({
                    order_id: orderId || null,
                    payment_id: paymentId || null,
                    signature: signature || null,
                    batch_id: batchId || null,
                    customer_id: customerId || null,
                    total_travelers: travelers?.length || 0,
                    total_amount: fareBreakup?.totalBasicCost || null,
                    final_amount: fareBreakup?.finalAmount || null,
                    coupon_id: fareBreakup?.couponId || null,
                    payment_status: "failed",
                    request_data: req.body,
                    error_message: errorMessage,
                    error_type: "TREK_NOT_FOUND",
                    available_slots: null,
                    requested_slots: travelers?.length || 0,
                    payment_failed: true
                });
                
                console.log("Payment failed data saved to payment_failed table - Trek Not Found");
            } catch (saveError) {
                logger.error('payment', 'Failed to save payment failed record', { error: saveError.message });
            }
            
            return res.status(404).json({
                success: false,
                message: "Trek not found or inactive",
            });
        }

        // Validate batch exists and has enough slots
        const batch = await Batch.findOne({
            where: { id: batchId, trek_id: trekId },
        });

        if (!batch) {
            const errorMessage = `Batch not found. Batch ID: ${batchId}, Trek ID: ${trekId}`;
            
            // Save failed payment data to PaymentFailed table
            try {
                await PaymentFailed.create({
                    order_id: orderId || null,
                    payment_id: paymentId || null,
                    signature: signature || null,
                    batch_id: batchId || null,
                    customer_id: customerId || null,
                    total_travelers: travelers?.length || 0,
                    total_amount: fareBreakup?.totalBasicCost || null,
                    final_amount: fareBreakup?.finalAmount || null,
                    coupon_id: fareBreakup?.couponId || null,
                    payment_status: "failed",
                    request_data: req.body,
                    error_message: errorMessage,
                    error_type: "BATCH_NOT_FOUND",
                    available_slots: null,
                    requested_slots: travelers?.length || 0,
                    payment_failed: true
                });
                
                console.log("Payment failed data saved to payment_failed table - Batch Not Found");
            } catch (saveError) {
                logger.error('payment', 'Failed to save payment failed record', { error: saveError.message });
            }
            
            return res.status(404).json({
                success: false,
                message: "Batch not found",
            });
        }

        // Check if batch has enough available slots
        const availableSlots =
            batch.available_slots || batch.capacity - (batch.booked_slots || 0);
        if (availableSlots < travelers.length) {
            const errorMessage = `Not enough slots available. Available: ${availableSlots}, Requested: ${travelers.length}`;
            
            // Save failed payment data to PaymentFailed table
            try {
                await PaymentFailed.create({
                    order_id: orderId || null,
                    payment_id: paymentId || null,
                    signature: signature || null,
                    batch_id: batchId || null,
                    customer_id: customerId || null,
                    total_travelers: travelers.length,
                    total_amount: fareBreakup?.totalBasicCost || null,
                    final_amount: fareBreakup?.finalAmount || null,
                    coupon_id: fareBreakup?.couponId || null,
                    payment_status: "failed",
                    request_data: req.body, // Store complete request body
                    error_message: errorMessage,
                    error_type: "SLOTS_UNAVAILABLE",
                    available_slots: availableSlots,
                    requested_slots: travelers.length,
                    payment_failed: true
                });
                
                console.log("Payment failed data saved to payment_failed table");
            } catch (saveError) {
                logger.error('payment', 'Failed to save payment failed record', { error: saveError.message });
                // Continue with error response even if saving fails
            }
            
            return res.status(400).json({
                success: false,
                message: errorMessage,
            });
        }

        // Extract pricing from fare breakup
        const participantCount = travelers.length;
        const {
            totalBasicCost,
            vendorDiscount,
            couponDiscount,
            couponId,
            platformFees,
            gst,
            insurance,
            freeCancellation,
            remainingAmount,
            finalAmount
        } = fareBreakup;

        // Find coupon if couponId is provided
        let appliedCoupon = null;
        if (couponId) {
            appliedCoupon = await Coupon.findOne({
                where: { id: couponId, status: "active" },
            });
        }

        // Determine payment status based on isPartialAmount
        let paymentStatus;
        let bookingStatus = "confirmed";
        
        if (isPartialAmount) {
            paymentStatus = "partial";
        } else {
            paymentStatus = "full_paid";
        }

        // Calculate remaining amount for partial payments
        const remainingAmountToStore = isPartialAmount ? remainingAmount : 0;

        // Load policy snapshot to store at booking time
        const { CancellationPolicySettings } = require('../../models');
        let policySnapshot = null;
        try {
            const ps = await CancellationPolicySettings?.findOne({
                where: { is_active: true },
                order: [['created_at', 'DESC']],
            });
            if (ps) policySnapshot = JSON.stringify(ps.toJSON());
        } catch (_) {}

        // Create the booking
        const bookingData = {
            customer_id: customerId,
            trek_id: trekId,
            batch_id: batchId,
            vendor_id: trek.vendor_id,
            city_id: cityId,
            coupon_id: couponId || null,
            total_travelers: participantCount,
            total_amount: totalBasicCost,
            discount_amount: vendorDiscount + couponDiscount,
            final_amount: finalAmount,
            advance_amount: finalAmount,
            remaining_amount: remainingAmountToStore,
            status: bookingStatus,
            payment_status: paymentStatus,
            booking_date: new Date(),
            special_requests: specialRequests,
            // Fare breakup details
            total_basic_cost: totalBasicCost,
            vendor_discount: vendorDiscount,
            coupon_discount: couponDiscount,
            platform_fees: platformFees,
            gst_amount: gst,
            insurance_amount: insurance,
            free_cancellation_amount: freeCancellation,
            // Policy & coupon snapshot at booking time
            policy_version_snapshot: policySnapshot,
            coupon_metadata: appliedCoupon ? JSON.stringify({
                id: appliedCoupon.id,
                code: appliedCoupon.code,
                discount_percentage: appliedCoupon.discount_percentage,
                discount_amount: couponDiscount,
            }) : null,
        };

        const booking = await Booking.create(bookingData);

        // Create travelers
        const travelerPromises = travelers.map(async (travelerData, index) => {
            // Create or find traveler using the new format
            let traveler = await Traveler.findOne({
                where: {
                    id: travelerData.id,
                    customer_id: travelerData.customerId,
                },
            });

            if (!traveler) {
                const travelerPayload = {
                    customer_id: travelerData.customerId,
                    name: travelerData.name,
                    age: travelerData.age,
                    gender: travelerData.gender,
                    is_active: travelerData.isActive,
                };
                if (travelerData.id) {
                    travelerPayload.id = travelerData.id;
                }
                traveler = await Traveler.create(travelerPayload);
            }

            // Create booking traveler relationship
            return BookingTraveler.create({
                booking_id: booking.id,
                traveler_id: traveler.id,
                is_primary: index === 0,
                status: "confirmed",
            });
        });

        await Promise.all(travelerPromises);

        // Update batch slots
        try {
            await updateBatchSlotsOnBooking(batchId, travelers.length);
        } catch (slotError) {
            console.error("Error updating batch slots:", slotError);
        }

        // Determine payment type
        const paymentType = isPartialAmount ? "advance" : "balance_online";

        // Create payment log
        await PaymentLog.create({
            booking_id: booking.id,
            amount: booking.final_amount,
            payment_method: "razorpay",
            payment_type: paymentType,
            transaction_id: paymentId,
            razorpay_order_id: orderId,
            status: "success",
            payment_details: JSON.stringify(payment),
        });

        // Create GST tax event for finance ledger
        const { TaxEvent } = require('../../models');
        if (TaxEvent && gst && parseFloat(gst) > 0) {
            await TaxEvent.create({
                booking_id: booking.id,
                event_type: 'collection',
                taxable_base: parseFloat(totalBasicCost) - parseFloat(vendorDiscount || 0) - parseFloat(couponDiscount || 0),
                gst_rate: 5,
                gst_amount: parseFloat(gst),
            });
        }


        // Log coupon application if coupon was used
        if (appliedCoupon) {
            try {
                const CouponAuditService = require('../../services/couponAuditService');
                await CouponAuditService.logCouponApplication(
                    appliedCoupon,
                    booking.id,
                    customerId,
                    couponDiscount,
                    totalBasicCost,
                    finalAmount,
                    trekId,
                    batchId,
                    trek.vendor_id,
                    req
                );
            } catch (auditError) {
                console.error('Error logging coupon application:', auditError);
                // Don't fail the booking if audit logging fails
            }
        }

        // Fetch complete booking with associations
        const completeBooking = await Booking.findOne({
            where: { id: booking.id },
            include: [
                { 
                    model: Trek, 
                    as: "trek",
                    include: [{ model: Destination, as: "destinationData" }]
                },
                { model: Vendor, as: "vendor" },
                { model: Batch, as: "batch" },
                { model: City, as: "city" },
                {
                    model: BookingTraveler,
                    as: "travelers",
                    include: [{ model: Traveler, as: "traveler" }],
                },
                { model: PaymentLog, as: "payments" },
            ],
        });

        // Format the response to parse company_info
        const formattedBookingData = completeBooking.toJSON();
        
        // Parse and format company_info if it exists in vendor
        if (formattedBookingData.vendor?.company_info) {
            try {
                formattedBookingData.vendor.company_info = JSON.parse(formattedBookingData.vendor.company_info);
            } catch (error) {
                console.error('Error parsing company_info:', error);
                formattedBookingData.vendor.company_info = null;
            }
        }

        res.json({
            success: true,
            message: "Booking created successfully with payment",
            data: formattedBookingData,
            payment: {
                orderId,
                paymentId,
                amount: payment.amount / 100, // Convert from paise to rupees
                status: payment.status,
            },
            fareBreakup: {
                totalBasicCost: parseFloat(totalBasicCost).toFixed(2),
                vendorDiscount: parseFloat(vendorDiscount).toFixed(2),
                couponDiscount: parseFloat(couponDiscount).toFixed(2),
                couponId: couponId || "",
                platformFees: parseFloat(platformFees).toFixed(2),
                gst: parseFloat(gst).toFixed(2),
                insurance: parseFloat(insurance).toFixed(2),
                freeCancellation: parseFloat(freeCancellation).toFixed(2),
                remainingAmount: parseFloat(remainingAmount).toFixed(2),
                finalAmount: parseFloat(finalAmount).toFixed(2),
            },
            paymentDetails: {
                isPartialPayment: isPartialAmount,
                paymentStatus,
                totalAmount: parseFloat(totalBasicCost).toFixed(2),
                paidAmount: parseFloat(finalAmount).toFixed(2),
                remainingAmount: parseFloat(remainingAmountToStore).toFixed(2),
                participantCount,
                isPartialAmount,
                remaining_amount: parseFloat(remainingAmountToStore).toFixed(2),
            },
        });
    } catch (error) {
        console.error("Error verifying payment:", error);
        
        // Save failed payment data to PaymentFailed table for unexpected errors
        try {
            const {
                orderId,
                paymentId,
                signature,
                batchId,
                travelers,
                fareBreakup,
            } = req.body;
            const customerId = req.customer?.id || null;
            
            await PaymentFailed.create({
                order_id: orderId || null,
                payment_id: paymentId || null,
                signature: signature || null,
                batch_id: batchId || null,
                customer_id: customerId,
                total_travelers: travelers?.length || 0,
                total_amount: fareBreakup?.totalBasicCost || null,
                final_amount: fareBreakup?.finalAmount || null,
                coupon_id: fareBreakup?.couponId || null,
                payment_status: "failed",
                request_data: req.body,
                error_message: error.message || "Unexpected error during payment verification",
                error_type: "UNEXPECTED_ERROR",
                available_slots: null,
                requested_slots: travelers?.length || 0,
                payment_failed: true
            });
            
            console.log("Payment failed data saved to payment_failed table - Unexpected Error");
        } catch (saveError) {
            console.error("Failed to save payment failed data in catch block:", saveError);
        }
        
        res.status(500).json({
            success: false,
            message: "Failed to verify payment",
        });
    }
};

// Mobile: Cancel booking
exports.cancelBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const customerId = req.customer.id;

        // Verify ownership before handing off to service
        const booking = await Booking.findOne({
            where: { id, customer_id: customerId },
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        const cancellationService = require('../../services/cancellationService');
        const result = await cancellationService.cancelBooking({
            bookingId: parseInt(id, 10),
            actorId: customerId,
            actorType: 'customer',
        });

        if (result.status === 409) {
            return res.status(409).json({ success: false, message: result.error });
        }
        if (result.status === 404) {
            return res.status(404).json({ success: false, message: result.error });
        }
        if (result.status !== 200) {
            return res.status(result.status || 500).json({ success: false, message: result.error });
        }

        // Update batch slots
        try {
            await updateBatchSlotsOnCancellation(booking.batch_id, booking.total_travelers);
        } catch (_) { /* non-fatal */ }

        return res.json({
            success: true,
            message: result.refundResult?.message || "Booking cancelled successfully",
            data: result.booking,
            refund: {
                amount: result.refundResult?.refund ?? 0,
                deduction: result.refundResult?.deduction ?? 0,
                deduction_percent: result.refundResult?.deduction_percent,
                slab: result.refundResult?.slab_info,
                gst_refunded: result.refundResult?.gst_refunded,
                settlement_verified: result.settlementVerified,
            },
        });
    } catch (error) {
        logger.error('booking', 'Error cancelling booking', {
            booking_id: req.params.id,
            customer_id: req.customer?.id,
            error: error.message,
        });
        res.status(500).json({
            success: false,
            message: "Failed to cancel booking",
        });
    }
};
