const { 
    Booking, CancellationBooking, CancellationPolicy, 
    Batch, VendorWallet, CommissionLog, AuditLog 
} = require("../models");
const paymentService = require("./paymentService");
const notificationService = require("./notificationService");
const logger = require("../utils/logger");
const { sequelize } = require("../models");

class CancellationService {
    /**
     * Process booking cancellation with policy-based refund
     */
    async cancelBooking(bookingId, customerId, reason, cancelAllTravelers = true) {
        const transaction = await sequelize.transaction();
        
        try {
            // 1. Fetch booking with related data
            const booking = await Booking.findOne({
                where: { 
                    id: bookingId,
                    customer_id: customerId,
                    status: "confirmed"
                },
                include: [
                    { model: Batch, as: "batch" },
                    { model: CancellationPolicy, as: "cancellation_policy" }
                ],
                transaction
            });

            if (!booking) {
                throw new Error("Booking not found or already cancelled");
            }

            if (booking.payment_status !== "full_paid") {
                throw new Error("Cannot cancel booking with pending payment");
            }

            // 2. Calculate refund based on cancellation policy
            const refundCalculation = await this.calculateRefund(
                booking,
                cancelAllTravelers ? booking.total_travelers : 1
            );

            // 3. Create cancellation record
            const cancellation = await CancellationBooking.create({
                booking_id: bookingId,
                customer_id: customerId,
                vendor_id: booking.vendor_id,
                trek_id: booking.trek_id,
                batch_id: booking.batch_id,
                cancellation_reason: reason,
                cancelled_travelers: cancelAllTravelers ? booking.total_travelers : 1,
                original_amount: booking.final_amount,
                refund_amount: refundCalculation.refund_amount,
                refund_percentage: refundCalculation.refund_percentage,
                platform_retention: refundCalculation.platform_retention,
                vendor_penalty: refundCalculation.vendor_penalty,
                cancellation_policy_applied: refundCalculation.policy_tier,
                status: "pending",
                cancelled_at: new Date()
            }, { transaction });

            // 4. Update booking status
            await booking.update({
                status: "cancelled",
                cancellation_id: cancellation.id,
                cancelled_at: new Date()
            }, { transaction });

            // 5. Release batch slots
            const batch = await Batch.findByPk(booking.batch_id, {
                lock: transaction.LOCK.UPDATE,
                transaction
            });

            const releasedSlots = cancelAllTravelers ? booking.total_travelers : 1;
            await batch.update({
                booked_slots: batch.booked_slots - releasedSlots,
                available_slots: batch.available_slots + releasedSlots
            }, { transaction });

            // 6. Adjust vendor wallet
            await this.adjustVendorWallet(
                booking.vendor_id,
                refundCalculation,
                transaction
            );

            // 7. Update commission log
            const commissionLog = await CommissionLog.findOne({
                where: { booking_id: bookingId },
                transaction
            });

            if (commissionLog && commissionLog.status === "pending_settlement") {
                await commissionLog.update({
                    status: "cancelled",
                    cancellation_adjustment: refundCalculation.vendor_penalty
                }, { transaction });
            }

            // 8. Initiate Razorpay refund (if refund > 0)
            if (refundCalculation.refund_amount > 0) {
                const refundResult = await paymentService.processRefund(
                    bookingId,
                    refundCalculation.refund_amount,
                    reason
                );

                await cancellation.update({
                    refund_id: refundResult.refund_id,
                    refund_status: "processing"
                }, { transaction });
            } else {
                await cancellation.update({
                    refund_status: "not_applicable"
                }, { transaction });
            }

            // 9. Create audit log
            await AuditLog.create({
                action: "booking_cancelled",
                entity_type: "booking",
                entity_id: bookingId,
                performed_by_type: "customer",
                performed_by_id: customerId,
                changes: {
                    before: { status: "confirmed" },
                    after: { status: "cancelled" }
                },
                metadata: {
                    cancellation_id: cancellation.id,
                    refund_amount: refundCalculation.refund_amount,
                    reason
                }
            }, { transaction });

            await transaction.commit();

            // 10. Send notifications (async)
            setImmediate(async () => {
                try {
                    await notificationService.send(
                        notificationService.EVENTS.BOOKING_CANCELLED,
                        [
                            { userId: customerId, userType: "customer" },
                            { userId: booking.vendor.user_id, userType: "vendor" }
                        ],
                        {
                            booking_id: bookingId,
                            refund_amount: refundCalculation.refund_amount,
                            refund_timeline: "5-7 business days"
                        },
                        "high"
                    );
                } catch (error) {
                    logger.error("notification", "Cancellation notification failed", {
                        error: error.message,
                        bookingId
                    });
                }
            });

            logger.info("cancellation", "Booking cancelled successfully", {
                bookingId,
                cancellationId: cancellation.id,
                refundAmount: refundCalculation.refund_amount
            });

            return {
                success: true,
                cancellation_id: cancellation.id,
                refund_amount: refundCalculation.refund_amount,
                refund_status: "processing",
                refund_timeline: "5-7 business days"
            };
        } catch (error) {
            await transaction.rollback();
            
            logger.error("cancellation", "Cancellation failed", {
                error: error.message,
                bookingId,
                customerId
            });
            
            throw error;
        }
    }

    /**
     * Calculate refund based on cancellation policy
     */
    async calculateRefund(booking, cancelledTravelers) {
        try {
            const policy = booking.cancellation_policy;
            if (!policy) {
                throw new Error("No cancellation policy found");
            }

            // Calculate days before trek
            const trekStartDate = new Date(booking.batch.start_date);
            const today = new Date();
            const daysBeforeTrek = Math.ceil((trekStartDate - today) / (1000 * 60 * 60 * 24));

            // Parse policy tiers
            const policyTiers = JSON.parse(policy.policy_tiers || "[]");
            
            // Find applicable tier
            let applicableTier = null;
            for (const tier of policyTiers.sort((a, b) => b.days_before - a.days_before)) {
                if (daysBeforeTrek >= tier.days_before) {
                    applicableTier = tier;
                    break;
                }
            }

            if (!applicableTier) {
                // No refund if cancelled too late
                applicableTier = { days_before: 0, refund_percentage: 0 };
            }

            // Calculate amounts
            const perTravelerAmount = parseFloat(booking.final_amount) / booking.total_travelers;
            const cancellationAmount = perTravelerAmount * cancelledTravelers;
            
            const refundPercentage = applicableTier.refund_percentage;
            const refundAmount = (cancellationAmount * refundPercentage) / 100;
            const platformRetention = cancellationAmount - refundAmount;

            // Calculate vendor penalty (vendor loses commission on cancelled amount)
            const commissionPercentage = booking.platform_fee_percentage || 10;
            const vendorPenalty = (cancellationAmount * commissionPercentage) / 100;

            return {
                refund_amount: refundAmount,
                refund_percentage: refundPercentage,
                platform_retention: platformRetention,
                vendor_penalty: vendorPenalty,
                policy_tier: applicableTier,
                days_before_trek: daysBeforeTrek
            };
        } catch (error) {
            logger.error("cancellation", "Refund calculation failed", {
                error: error.message,
                bookingId: booking.id
            });
            throw error;
        }
    }

    /**
     * Adjust vendor wallet after cancellation
     */
    async adjustVendorWallet(vendorId, refundCalculation, transaction) {
        try {
            const wallet = await VendorWallet.findOne({
                where: { vendor_id: vendorId },
                transaction
            });

            if (!wallet) {
                throw new Error("Vendor wallet not found");
            }

            // Deduct vendor penalty from pending settlement
            await wallet.update({
                pending_settlement: parseFloat(wallet.pending_settlement) - refundCalculation.vendor_penalty
            }, { transaction });

            logger.info("cancellation", "Vendor wallet adjusted", {
                vendorId,
                penalty: refundCalculation.vendor_penalty
            });
        } catch (error) {
            logger.error("cancellation", "Wallet adjustment failed", {
                error: error.message,
                vendorId
            });
            throw error;
        }
    }

    /**
     * Get cancellation details
     */
    async getCancellationDetails(cancellationId, customerId) {
        try {
            const cancellation = await CancellationBooking.findOne({
                where: { 
                    id: cancellationId,
                    customer_id: customerId 
                },
                include: [
                    { model: Booking, as: "booking" },
                    { model: Trek, as: "trek" }
                ]
            });

            if (!cancellation) {
                throw new Error("Cancellation not found");
            }

            return {
                success: true,
                data: cancellation
            };
        } catch (error) {
            logger.error("cancellation", "Failed to fetch cancellation details", {
                error: error.message,
                cancellationId
            });
            throw error;
        }
    }
}

module.exports = new CancellationService();
