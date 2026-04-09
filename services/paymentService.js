// Payment Service — Razorpay
const crypto = require("crypto");
const razorpay = require("../config/razorpay");

const {
    Booking, Batch, Traveler,
    CommissionLog, AuditLog, PendingBooking
} = require("../models");
// AuditLog may be undefined if the model/table doesn't exist — handled gracefully below
const fareCalculationService = require("./fareCalculationService");
const notificationService = require("./notificationService");
const logger = require("../utils/logger");
const { sequelize } = require("../models");

class PaymentService {
    /**
     * Step 1: Create Razorpay order
     * Returns { success, order: { id, amount, currency, ... }, key_id }
     */
    async createOrder(fareToken, travelers, customerId) {
        try {
            // 1. Verify fare token
            const fareData = fareCalculationService.verifyFareToken(fareToken);

            // 2. Validate traveler count
            if (travelers.length !== fareData.data.travelerCount) {
                throw new Error("Traveler count mismatch");
            }

            // 3. Check slot availability
            const batch = await Batch.findByPk(fareData.data.batchId);
            const availableSlots = batch.available_slots ||
                (batch.capacity - (batch.booked_slots || 0));

            if (availableSlots < travelers.length) {
                throw new Error(`Only ${availableSlots} slots available`);
            }

            // 4. Create Razorpay order
            const amountInPaise = Math.round(fareData.data.finalAmount * 100);
            const receipt = `ORDER_${customerId}_${Date.now()}`;

            const order = await razorpay.orders.create({
                amount: amountInPaise,
                currency: "INR",
                receipt,
            });

            // 5. Store pending booking
            await PendingBooking.create({
                order_id: order.id,
                customer_id: customerId,
                batch_id: fareData.data.batchId,
                trek_id: fareData.data.trekId,
                vendor_id: fareData.data.vendorId,
                traveler_count: travelers.length,
                travelers,
                fare_data: fareData.data,
                amount: fareData.data.finalAmount,
                status: "pending",
                expires_at: new Date(Date.now() + 15 * 60 * 1000)
            });

            logger.info("payment", "Razorpay order created", {
                orderId: order.id, customerId,
                amount: fareData.data.finalAmount
            });

            return {
                success: true,
                order,
                key_id: process.env.RAZORPAY_KEY_ID,
            };
        } catch (error) {
            logger.error("payment", "Order creation failed", {
                error: error.message, customerId
            });
            throw error;
        }
    }

    /**
     * Step 2: Verify Razorpay signature and create booking (atomic)
     * Called after Flutter Razorpay SDK returns payment success
     */
    async verifyPaymentAndCreateBooking(orderId, paymentId, signature, customerId) {
        // Verify HMAC-SHA256 signature
        const body = orderId + "|" + paymentId;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "placeholder_secret")
            .update(body)
            .digest("hex");

        if (expectedSignature !== signature) {
            throw new Error("Invalid payment signature");
        }

        const transaction = await sequelize.transaction();

        try {
            // Fetch pending booking
            const pendingBooking = await PendingBooking.findOne({
                where: {
                    order_id: orderId,
                    customer_id: customerId,
                    status: "pending"
                },
                transaction
            });

            if (!pendingBooking) {
                throw new Error("Pending booking not found or already processed");
            }

            if (new Date() > pendingBooking.expires_at) {
                throw new Error("Booking session expired");
            }

            // Parse fare_data (MySQL may return JSON columns as strings)
            const fareData = typeof pendingBooking.fare_data === "string"
                ? JSON.parse(pendingBooking.fare_data)
                : pendingBooking.fare_data;

            // Parse travelers (MySQL may return JSON columns as strings)
            const travelers = typeof pendingBooking.travelers === "string"
                ? JSON.parse(pendingBooking.travelers)
                : pendingBooking.travelers;

            // Atomic slot reservation
            const batch = await Batch.findByPk(pendingBooking.batch_id, {
                lock: transaction.LOCK.UPDATE,
                transaction
            });

            const availableSlots = batch.available_slots ||
                (batch.capacity - (batch.booked_slots || 0));

            if (availableSlots < pendingBooking.traveler_count) {
                throw new Error("Slots no longer available");
            }

            // Create booking
            const booking = await Booking.create({
                customer_id: customerId,
                trek_id: pendingBooking.trek_id,
                vendor_id: pendingBooking.vendor_id,
                batch_id: pendingBooking.batch_id,
                coupon_id: fareData.couponId,
                total_travelers: pendingBooking.traveler_count,
                total_amount: fareData.baseTotalAmount,
                discount_amount: fareData.discount,
                final_amount: fareData.finalAmount,
                payment_status: "full_paid",
                status: "confirmed",
                booking_date: new Date(),
                razorpay_order_id: orderId,
                razorpay_payment_id: paymentId,
                payment_method: "razorpay",
                tax_amount: fareData.totalTax,
                tax_breakdown: fareData.taxes
            }, { transaction });

            // Create travelers
            await Promise.all(
                travelers.map((traveler, index) =>
                    Traveler.create({
                        booking_id: booking.id,
                        customer_id: customerId,
                        name: traveler.name,
                        age: traveler.age,
                        gender: traveler.gender,
                        id_proof_type: traveler.id_proof_type,
                        id_proof_number: traveler.id_proof_number,
                        is_primary: index === 0
                    }, { transaction })
                )
            );

            // Update batch slots
            await batch.update({
                booked_slots: (batch.booked_slots || 0) + pendingBooking.traveler_count,
                available_slots: availableSlots - pendingBooking.traveler_count
            }, { transaction });

            // Log commission
            const commissionAmount = fareData.commission;
            const vendorAmount = fareData.finalAmount - commissionAmount;

            await CommissionLog.create({
                booking_id: booking.id,
                vendor_id: fareData.vendorId,
                trek_id: fareData.trekId,
                booking_amount: fareData.finalAmount,
                commission_rate: fareData.commissionPercentage || 0,
                commission_amount: commissionAmount,
                status: "pending",
            }, { transaction });

            // Vendor wallet update skipped — VendorWallet model not available in this schema

            // Mark pending booking as completed
            await pendingBooking.update({ status: "completed", booking_id: booking.id }, { transaction });

            // Audit log (AuditLog model optional — skip if not available)
            if (AuditLog) {
                await AuditLog.create({
                    action: "booking_created",
                    entity_type: "booking",
                    entity_id: booking.id,
                    performed_by_type: "customer",
                    performed_by_id: customerId,
                    changes: { before: null, after: booking.toJSON() },
                    metadata: { razorpay_order_id: orderId, razorpay_payment_id: paymentId, amount: fareData.finalAmount }
                }, { transaction });
            }

            await transaction.commit();

            // Notifications (async)
            setImmediate(async () => {
                try {
                    await notificationService.sendBookingConfirmation(booking.id);
                } catch (err) {
                    logger.error("notification", "Failed to send booking confirmation", {
                        bookingId: booking.id, error: err.message
                    });
                }
            });

            logger.info("payment", "Booking created via Razorpay", {
                bookingId: booking.id, customerId, amount: fareData.finalAmount
            });

            return {
                success: true,
                booking_id: booking.id,
                status: "confirmed",
                payment_status: "full_paid",
                amount: fareData.finalAmount
            };
        } catch (error) {
            await transaction.rollback();
            // Log full Sequelize error details to diagnose validation errors
            logger.error("payment", "Payment verification failed", {
                error: error.message,
                errorName: error.name,
                errorFields: error.errors ? error.errors.map(e => `${e.path}: ${e.message}`) : undefined,
                sql: error.sql,
                orderId, customerId
            });
            throw error;
        }
    }

    /**
     * Process refund via Razorpay
     */
    async processRefund(bookingId, refundAmount, reason) {
        try {
            const booking = await Booking.findByPk(bookingId);
            if (!booking) throw new Error("Booking not found");

            const paymentId = booking.razorpay_payment_id;
            if (!paymentId) throw new Error("No payment reference found for refund");

            const refund = await razorpay.payments.refund(paymentId, {
                amount: Math.round(refundAmount * 100),
                notes: { reason: reason || "Customer cancellation" }
            });

            logger.info("payment", "Razorpay refund initiated", {
                bookingId, refundId: refund.id, amount: refundAmount
            });

            return {
                success: true,
                refund_id: refund.id,
                amount: refundAmount,
                status: refund.status
            };
        } catch (error) {
            logger.error("payment", "Refund failed", { error: error.message, bookingId });
            throw error;
        }
    }
}

module.exports = new PaymentService();
