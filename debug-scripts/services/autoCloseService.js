/**
 * Auto-Close Service (Vendor Silent Close)
 *
 * Trigger: Arrival Complete event fires per booking.
 * Condition: balance unpaid AND vendor has NOT marked collected.
 * Action:
 *   - Set booking status = 'paid_auto'
 *   - auto_close_reason = 'arrival_complete_no_vendor_mark'
 *   - is_vendor_silent_close = true
 *   - Create immutable BookingAuditLog record
 *   - Block direct refund until admin review or dispute resolution
 *
 * Per-booking, never per-trek batch.
 */

const { sequelize } = require('../models');
const logger = require('../utils/logger');

class AutoCloseService {
    /**
     * Process arrival-complete event for a single booking.
     * @param {number} bookingId
     * @param {number} [triggeredBy]  system or admin user id
     * @returns {Object} { skipped, closed, reason }
     */
    async processArrivalComplete(bookingId, triggeredBy = null) {
        const { Booking, VendorCollection, BookingAuditLog, PaymentLog } = require('../models');

        const transaction = await sequelize.transaction();
        try {
            const booking = await Booking.findByPk(bookingId, {
                lock: transaction.LOCK.UPDATE,
                transaction,
            });

            if (!booking) {
                await transaction.rollback();
                return { skipped: true, reason: 'booking_not_found' };
            }

            // Only act on confirmed bookings
            if (!['confirmed', 'pending'].includes(booking.status)) {
                await transaction.rollback();
                return { skipped: true, reason: `status_is_${booking.status}` };
            }

            // Check balance: remaining_amount > 0 means balance is unpaid
            const balanceDue = parseFloat(booking.remaining_amount) || 0;
            if (balanceDue <= 0) {
                await transaction.rollback();
                return { skipped: true, reason: 'balance_already_paid' };
            }

            // Check if vendor has marked collection
            const vendorMark = await VendorCollection.findOne({
                where: { booking_id: bookingId },
                transaction,
            });

            if (vendorMark) {
                await transaction.rollback();
                return { skipped: true, reason: 'vendor_already_marked_collected' };
            }

            // --- Perform auto-close ---
            const now = new Date();
            const disputeDeadline = new Date(now.getTime() + (booking.dispute_ttl_hours || 48) * 3600 * 1000);

            const beforeState = {
                status: booking.status,
                is_vendor_silent_close: booking.is_vendor_silent_close,
                auto_close_reason: booking.auto_close_reason,
            };

            await booking.update({
                status: 'paid_auto',
                is_vendor_silent_close: true,
                auto_close_reason: 'arrival_complete_no_vendor_mark',
                paid_auto_at: now,
                arrival_complete_at: now,
            }, { transaction });

            // Immutable audit record
            await BookingAuditLog?.create({
                booking_id: bookingId,
                actor_id: triggeredBy,
                actor_type: 'system',
                action: 'auto_close',
                before_state: JSON.stringify(beforeState),
                after_state: JSON.stringify({
                    status: 'paid_auto',
                    is_vendor_silent_close: true,
                    auto_close_reason: 'arrival_complete_no_vendor_mark',
                    dispute_deadline: disputeDeadline.toISOString(),
                }),
                metadata: JSON.stringify({ dispute_ttl_hours: booking.dispute_ttl_hours || 48 }),
                created_at: now,
            }, { transaction });

            await transaction.commit();

            logger.info('auto_close', 'Booking auto-closed (vendor silent close)', {
                booking_id: bookingId,
                balance_due: balanceDue,
                dispute_deadline: disputeDeadline.toISOString(),
            });

            return {
                skipped: false,
                closed: true,
                booking_id: bookingId,
                balance_due: balanceDue,
                dispute_deadline: disputeDeadline,
            };
        } catch (error) {
            await transaction.rollback();
            logger.error('auto_close', 'Failed to auto-close booking', {
                booking_id: bookingId,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Admin: reverse an auto-close with full audit trail.
     * @param {Object} opts
     * @param {number}  opts.bookingId
     * @param {number}  opts.adminId
     * @param {string}  opts.reason
     * @param {string}  opts.idempotencyToken  – required; prevents duplicate reverse actions
     */
    async reverseAutoClose({ bookingId, adminId, reason, idempotencyToken }) {
        const { Booking, BookingAuditLog } = require('../models');

        if (!idempotencyToken) {
            return { status: 400, error: 'idempotency_token is required' };
        }

        const transaction = await sequelize.transaction();
        try {
            // Idempotency: check if this token was already used
            const existingAction = await BookingAuditLog?.findOne({
                where: { booking_id: bookingId, action: 'reverse_auto_close', idempotency_token: idempotencyToken },
                transaction,
            });
            if (existingAction) {
                await transaction.rollback();
                return { status: 409, error: 'This reverse action was already applied', idempotent: true };
            }

            const booking = await Booking.findByPk(bookingId, {
                lock: transaction.LOCK.UPDATE,
                transaction,
            });

            if (!booking) {
                await transaction.rollback();
                return { status: 404, error: 'Booking not found' };
            }

            if (!booking.is_vendor_silent_close) {
                await transaction.rollback();
                return { status: 422, error: 'Booking was not auto-closed' };
            }

            const beforeState = {
                status: booking.status,
                is_vendor_silent_close: booking.is_vendor_silent_close,
                auto_close_reason: booking.auto_close_reason,
            };

            await booking.update({
                status: 'confirmed',
                is_vendor_silent_close: false,
                auto_close_reason: null,
                paid_auto_at: null,
            }, { transaction });

            await BookingAuditLog?.create({
                booking_id: bookingId,
                actor_id: adminId,
                actor_type: 'admin',
                action: 'reverse_auto_close',
                before_state: JSON.stringify(beforeState),
                after_state: JSON.stringify({ status: 'confirmed', is_vendor_silent_close: false }),
                idempotency_token: idempotencyToken,
                metadata: JSON.stringify({ reason }),
                created_at: new Date(),
            }, { transaction });

            await transaction.commit();

            logger.info('auto_close', 'Auto-close reversed by admin', {
                booking_id: bookingId,
                admin_id: adminId,
                reason,
            });

            return { status: 200, booking_id: bookingId, reversed: true };
        } catch (error) {
            await transaction.rollback();
            logger.error('auto_close', 'Failed to reverse auto-close', {
                booking_id: bookingId,
                error: error.message,
            });
            throw error;
        }
    }
}

module.exports = new AutoCloseService();
