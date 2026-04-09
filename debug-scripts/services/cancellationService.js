/**
 * Cancellation Service
 * Implements the full standard and flexible cancellation business rules.
 *
 * Rules:
 *  - Idempotency: already-cancelled → 409
 *  - UTC second-precision time comparison
 *  - Boundary: exactly 72h=50%, 48h=70%, 24h=100%
 *  - Deductions on DISCOUNTED base fare (not total_amount)
 *  - GST refunded if cancelled before trek start; NOT refunded after
 *  - Platform fee NEVER refunded
 *  - Free-cancellation add-on: only platform fee + add-on fee retained
 *  - Policy snapshot at booking time (policy_version_snapshot)
 *  - Razorpay settlement verified before issuing refund
 */

const { sequelize } = require('../models');
const { roundHalfUp, calculateStandardRefund, calculateFlexibleRefundV2 } = require('../utils/refundCalculator');
const { getPaymentDetails } = require('../utils/razorpayUtils');
const logger = require('../utils/logger');

class CancellationService {
    /**
     * Cancel a booking.
     *
     * @param {Object} opts
     * @param {number}  opts.bookingId
     * @param {number}  opts.actorId          – customer / vendor / admin user id
     * @param {string}  opts.actorType        – "customer" | "vendor" | "admin"
     * @param {boolean} [opts.operatorOverride] – admin operator cancel: full refund
     * @returns {Object}  { booking, refundResult, cancellationRecord }
     */
    async cancelBooking({ bookingId, actorId, actorType, operatorOverride = false }) {
        const {
            Booking,
            Batch,
            PaymentLog,
            BookingAuditLog,
            TaxEvent,
            CancellationPolicySettings,
        } = require('../models');

        const transaction = await sequelize.transaction();
        try {
            // ── 1. Load booking ───────────────────────────────────────────────
            const booking = await Booking.findByPk(bookingId, {
                include: [{ model: Batch, as: 'batch', attributes: ['start_date', 'end_date'] }],
                lock: transaction.LOCK.UPDATE,
                transaction,
            });

            if (!booking) {
                await transaction.rollback();
                return { status: 404, error: 'Booking not found' };
            }

            // ── 2. Idempotency check ──────────────────────────────────────────
            if (booking.status === 'cancelled') {
                await transaction.rollback();
                return { status: 409, error: 'Booking is already cancelled' };
            }

            // ── 3. Determine trek start datetime (UTC) ────────────────────────
            const trekStartRaw = booking.batch?.start_date;
            if (!trekStartRaw) {
                await transaction.rollback();
                return { status: 422, error: 'Trek start date unavailable' };
            }
            const trekStart = new Date(trekStartRaw); // already UTC via Sequelize
            const cancellationTime = new Date(); // UTC

            // ── 4. Load policy snapshot ───────────────────────────────────────
            // Use booking-time snapshot if stored, else fall back to current settings
            let policySettings = null;
            if (booking.policy_version_snapshot) {
                try {
                    policySettings = JSON.parse(booking.policy_version_snapshot);
                } catch (_) { /* ignore */ }
            }
            if (!policySettings) {
                const policyType = booking.cancellation_policy_type || 'standard';
                policySettings = await CancellationPolicySettings?.findOne({
                    where: { policy_type: policyType, is_active: true },
                    order: [['created_at', 'DESC']],
                    transaction,
                });
            }

            // ── 5. Compute refund ─────────────────────────────────────────────
            let refundResult;
            const isAfterStart = cancellationTime >= trekStart;

            if (operatorOverride) {
                // Operator cancel: full base + GST refunded
                const baseFare = parseFloat(booking.total_basic_cost || booking.total_amount) || 0;
                const gst = parseFloat(booking.gst_amount) || 0;
                refundResult = {
                    deduction: 0,
                    refund: roundHalfUp(baseFare + gst),
                    deduction_percent: 0,
                    policy_type: 'operator_override',
                    slab_info: 'Operator cancellation — full refund',
                    gst_refunded: true,
                    platform_fee_refunded: false,
                    message: 'Operator cancel — full fare + GST refunded',
                };
            } else if (booking.cancellation_policy_type === 'flexible') {
                const timeRemainingHours = (trekStart.getTime() - cancellationTime.getTime()) / 3600000;
                const hasFreeCancellation = (parseFloat(booking.free_cancellation_amount) || 0) > 0;

                refundResult = calculateFlexibleRefundV2({
                    finalAmount: parseFloat(booking.final_amount) || 0,
                    platformFees: parseFloat(booking.platform_fees) || 0,
                    gstAmount: parseFloat(booking.gst_amount) || 0,
                    insuranceAmount: parseFloat(booking.insurance_amount) || 0,
                    freeCancellationAmount: parseFloat(booking.free_cancellation_amount) || 0,
                    advanceAmount: parseFloat(booking.advance_amount) || 0,
                    hasFreeCancellation,
                    timeRemainingHours,
                    bookingId,
                    policyName: 'flexible',
                });

                refundResult.gst_refunded = !isAfterStart;
                refundResult.platform_fee_refunded = false;
            } else {
                // Standard policy — deduction on DISCOUNTED base fare
                const discountedBase = parseFloat(booking.total_basic_cost || booking.total_amount) || 0;
                const gst = parseFloat(booking.gst_amount) || 0;
                const platformFee = parseFloat(booking.platform_fees) || 0;

                refundResult = calculateStandardRefund({
                    trekPrice: discountedBase,
                    trekStartDatetime: trekStart,
                    cancellationTime,
                    bookingStatus: booking.status,
                    policySettings,
                });

                // Add GST back to refund if cancelled before trek start
                if (!isAfterStart) {
                    refundResult.refund = roundHalfUp(refundResult.refund + gst);
                    refundResult.gst_refunded = true;
                } else {
                    refundResult.gst_refunded = false;
                }

                // Platform fee never refunded
                refundResult.platform_fee_refunded = false;
                refundResult.refund = Math.max(0, roundHalfUp(refundResult.refund));
            }

            // ── 6. Verify Razorpay settlement before issuing refund ───────────
            let settlementVerified = false;
            const payments = await PaymentLog.findAll({
                where: { booking_id: bookingId },
                transaction,
            });

            for (const p of payments) {
                if (p.transaction_id && p.status === 'success') {
                    try {
                        const pResult = await getPaymentDetails(p.transaction_id);
                        if (pResult.success && pResult.payment?.status === 'captured') {
                            settlementVerified = true;
                            break;
                        }
                    } catch (_) { /* continue checking other payments */ }
                }
            }

            // ── 7. Update booking ─────────────────────────────────────────────
            const beforeState = {
                status: booking.status,
                payment_status: booking.payment_status,
                refund_amount: booking.refund_amount,
                deduction_amount: booking.deduction_amount,
            };

            await booking.update({
                status: 'cancelled',
                cancelled_by: actorType,
                cancellation_time: cancellationTime,
                deduction_amount: refundResult.deduction,
                refund_amount: refundResult.refund,
                cancellation_rule: refundResult.slab_info || refundResult.policy_type,
            }, { transaction });

            // ── 8. Create immutable audit record ──────────────────────────────
            await BookingAuditLog?.create({
                booking_id: bookingId,
                actor_id: actorId,
                actor_type: actorType,
                action: 'cancellation',
                before_state: JSON.stringify(beforeState),
                after_state: JSON.stringify({
                    status: 'cancelled',
                    deduction_amount: refundResult.deduction,
                    refund_amount: refundResult.refund,
                    slab: refundResult.slab_info,
                }),
                ip_address: null, // caller can pass this if available
                created_at: cancellationTime,
            }, { transaction });

            // ── 9. Tax event: mark GST reversed if applicable ─────────────────
            if (refundResult.gst_refunded) {
                await TaxEvent?.create({
                    booking_id: bookingId,
                    taxable_base: parseFloat(booking.total_basic_cost || booking.total_amount) || 0,
                    gst_rate: 5,
                    gst_amount: parseFloat(booking.gst_amount) || 0,
                    event_type: 'reversal',
                    reversed_at: cancellationTime,
                    reversed_by: actorId,
                }, { transaction });
            }

            await transaction.commit();

            logger.info('cancellation', 'Booking cancelled', {
                booking_id: bookingId,
                actor: `${actorType}:${actorId}`,
                deduction: refundResult.deduction,
                refund: refundResult.refund,
                settlement_verified: settlementVerified,
                gst_refunded: refundResult.gst_refunded,
            });

            return {
                status: 200,
                booking: booking.toJSON(),
                refundResult,
                settlementVerified,
                operatorOverride,
            };
        } catch (error) {
            await transaction.rollback();
            logger.error('cancellation', 'Cancel booking failed', {
                booking_id: bookingId,
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Preview what the refund would be (no DB writes).
     */
    async previewCancellation(bookingId) {
        const { Booking, Batch, CancellationPolicySettings } = require('../models');

        const booking = await Booking.findByPk(bookingId, {
            include: [{ model: Batch, as: 'batch', attributes: ['start_date'] }],
        });
        if (!booking) return { status: 404, error: 'Booking not found' };
        if (booking.status === 'cancelled') return { status: 409, error: 'Already cancelled' };

        const trekStart = booking.batch?.start_date ? new Date(booking.batch.start_date) : null;
        if (!trekStart) return { status: 422, error: 'Trek start date unavailable' };

        const now = new Date();
        let policySettings = null;
        if (booking.policy_version_snapshot) {
            try { policySettings = JSON.parse(booking.policy_version_snapshot); } catch (_) { }
        }
        if (!policySettings) {
            const policyType = booking.cancellation_policy_type || 'standard';
            policySettings = await CancellationPolicySettings?.findOne({
                where: { policy_type: policyType, is_active: true },
                order: [['created_at', 'DESC']],
            });
        }

        let refundResult;
        const isAfterStart = now >= trekStart;

        if (booking.cancellation_policy_type === 'flexible') {
            const timeRemainingHours = (trekStart.getTime() - now.getTime()) / 3600000;
            const hasFreeCancellation = (parseFloat(booking.free_cancellation_amount) || 0) > 0;
            refundResult = calculateFlexibleRefundV2({
                finalAmount: parseFloat(booking.final_amount) || 0,
                platformFees: parseFloat(booking.platform_fees) || 0,
                gstAmount: parseFloat(booking.gst_amount) || 0,
                insuranceAmount: parseFloat(booking.insurance_amount) || 0,
                freeCancellationAmount: parseFloat(booking.free_cancellation_amount) || 0,
                advanceAmount: parseFloat(booking.advance_amount) || 0,
                hasFreeCancellation,
                timeRemainingHours,
                bookingId,
                policyName: 'flexible',
            });
        } else {
            const discountedBase = parseFloat(booking.total_basic_cost || booking.total_amount) || 0;
            refundResult = calculateStandardRefund({
                trekPrice: discountedBase,
                trekStartDatetime: trekStart,
                cancellationTime: now,
                bookingStatus: booking.status,
                policySettings,
            });
            if (!isAfterStart) refundResult.refund = roundHalfUp(refundResult.refund + (parseFloat(booking.gst_amount) || 0));
        }

        return {
            status: 200,
            preview: true,
            booking_id: bookingId,
            policy_type: booking.cancellation_policy_type || 'standard',
            deduction_amount: refundResult.deduction,
            refund_amount: refundResult.refund,
            deduction_percent: refundResult.deduction_percent,
            slab_info: refundResult.slab_info,
            gst_refunded: !isAfterStart,
            message: refundResult.message,
        };
    }
}

module.exports = new CancellationService();
