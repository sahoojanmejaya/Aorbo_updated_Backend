const { body } = require("express-validator");
const fareCalculationService = require("../../services/fareCalculationService");
const paymentService = require("../../services/paymentService");
const logger = require("../../utils/logger");

/**
 * SECURE BOOKING CONTROLLER
 * All calculations server-side, zero trust of client data
 */

// Validation rules
const calculateFareValidation = [
    body("batch_id").isInt().withMessage("Invalid batch ID"),
    body("traveler_count").isInt({ min: 1, max: 20 }).withMessage("Invalid traveler count"),
    body("coupon_code").optional().isString().trim(),
    body("add_insurance").optional().isBoolean(),
    body("add_cancellation_protection").optional().isBoolean()
];

const createOrderValidation = [
    body("fare_token").notEmpty().withMessage("Fare token required"),
    body("travelers").isArray({ min: 1, max: 20 }).withMessage("Travelers required"),
    body("travelers.*.name").trim().notEmpty().withMessage("Traveler name required"),
    body("travelers.*.age").isInt({ min: 1, max: 120 }).withMessage("Invalid age"),
    body("travelers.*.gender").isIn(["Male", "Female", "Other"]).withMessage("Invalid gender"),
    body("travelers.*.id_proof_type").optional().isString(),
    body("travelers.*.id_proof_number").optional().isString()
];

const verifyPaymentValidation = [
    body("razorpay_order_id").notEmpty().withMessage("Razorpay order ID required"),
    body("razorpay_payment_id").notEmpty().withMessage("Razorpay payment ID required"),
    body("razorpay_signature").notEmpty().withMessage("Razorpay signature required")
];

/**
 * Step 1: Calculate fare (server-side)
 * POST /v1/bookings/calculate-fare
 */
const calculateFare = async (req, res) => {
    try {
        const { batch_id, traveler_count, coupon_code, add_insurance, add_cancellation_protection } = req.body;
        const customerId = req.customer.id;

        logger.info("booking", "Calculating fare", {
            customerId,
            batchId: batch_id,
            travelerCount: traveler_count,
            couponCode: coupon_code,
            addInsurance: add_insurance,
            addCancellationProtection: add_cancellation_protection
        });

        const result = await fareCalculationService.calculateFare(
            batch_id,
            traveler_count,
            coupon_code,
            customerId,
            {
                addInsurance: add_insurance === true,
                addCancellationProtection: add_cancellation_protection === true
            }
        );

        res.json(result);
    } catch (error) {
        logger.error("booking", "Fare calculation failed", {
            error: error.message,
            customerId: req.customer.id,
            body: req.body
        });

        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Step 2: Create Razorpay order (server-side)
 * POST /v1/bookings/create-order
 * Returns: { success, order: { id, amount, currency, ... }, key_id }
 */
const createOrder = async (req, res) => {
    try {
        const { fare_token, travelers } = req.body;
        const customerId = req.customer.id;

        logger.info("booking", "Creating order", {
            customerId,
            travelerCount: travelers.length
        });

        const result = await paymentService.createOrder(
            fare_token,
            travelers,
            customerId
        );

        res.json(result);
    } catch (error) {
        logger.error("booking", "Order creation failed", {
            error: error.message,
            customerId: req.customer.id
        });

        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Step 3: Verify Razorpay payment signature and create booking (atomic)
 * POST /v1/bookings/verify-payment
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const customerId = req.customer.id;

        logger.info("booking", "Verifying Razorpay payment", {
            customerId,
            orderId: razorpay_order_id
        });

        const result = await paymentService.verifyPaymentAndCreateBooking(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            customerId
        );

        res.json(result);
    } catch (error) {
        logger.error("booking", "Payment verification failed", {
            error: error.message,
            customerId: req.customer.id,
            orderId: req.body.razorpay_order_id
        });

        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get customer bookings
 * GET /v1/bookings
 */
const getMyBookings = async (req, res) => {
    try {
        const customerId = req.customer.id;
        const { Booking, Trek, Batch, Vendor } = require("../../models");

        const bookings = await Booking.findAll({
            where: { customer_id: customerId },
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "duration", "base_price", "status"]
                },
                {
                    model: Batch,
                    as: "batch",
                    attributes: ["id", "start_date", "end_date"]
                }
            ],
            order: [["created_at", "DESC"]]
        });

        res.json({
            success: true,
            data: bookings
        });
    } catch (error) {
        logger.error("booking", "Failed to fetch bookings", {
            error: error.message,
            customerId: req.customer.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to fetch bookings"
        });
    }
};

/**
 * Get booking details
 * GET /v1/bookings/:id
 */
const getBookingDetails = async (req, res) => {
    try {
        const bookingId = req.params.id;
        const customerId = req.customer.id;
        const { Booking, Trek, Batch, Traveler } = require("../../models");

        const booking = await Booking.findOne({
            where: { 
                id: bookingId,
                customer_id: customerId 
            },
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "description", "duration", "base_price", "status"]
                },
                {
                    model: Batch,
                    as: "batch",
                    attributes: ["id", "start_date", "end_date", "pickup_point"]
                },
                {
                    model: Traveler,
                    as: "travelers"
                }
            ]
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found"
            });
        }

        res.json({
            success: true,
            data: booking
        });
    } catch (error) {
        logger.error("booking", "Failed to fetch booking details", {
            error: error.message,
            bookingId: req.params.id,
            customerId: req.customer.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to fetch booking details"
        });
    }
};

module.exports = {
    calculateFare,
    calculateFareValidation,
    createOrder,
    createOrderValidation,
    verifyPayment,
    verifyPaymentValidation,
    getMyBookings,
    getBookingDetails
};
