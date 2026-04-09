/**
 * Admin Booking Routes
 *
 * Handles booking-level operations for the Admin Inventory Panel:
 *   POST   /api/admin/bookings/:tbrId/bookings/:bookingId/cancellation-preview
 *   POST   /api/admin/bookings/:tbrId/bookings/:bookingId/cancel
 *   GET    /api/admin/bookings/pending-balances
 *   GET    /api/admin/bookings/active
 *   GET    /api/admin/bookings/summary
 */

const express = require('express');
const router  = express.Router();
const { Op }  = require('sequelize');

const {
    Booking, Batch, Trek, Customer, Vendor,
    CancellationBooking, sequelize
} = require('../../models');

const {
    calculateFlexibleRefundV2,
    calculateStandardRefund,
} = require('../../utils/refundCalculator');
const { updateBatchSlotsOnCancellation } = require('../../utils/batchSlotManager');
const logger = require('../../utils/logger');

// ─── Booking attributes needed for financial operations ───────────────────────
const BOOKING_ATTRS = [
    'id', 'status', 'payment_status', 'booking_date', 'createdAt',
    'trek_id', 'batch_id', 'customer_id', 'total_travelers',
    'total_amount', 'final_amount', 'advance_amount', 'remaining_amount',
    'platform_fees', 'gst_amount', 'insurance_amount', 'free_cancellation_amount',
    'cancellation_policy_type',
    'cancelled_by', 'refund_amount', 'deduction_amount', 'cancellation_rule',
    'special_requests'
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Find booking by numeric ID, include batch for trek-start date */
async function findBookingWithBatch(bookingId, transaction = undefined) {
    return Booking.findByPk(bookingId, {
        attributes: BOOKING_ATTRS,
        include: [{
            model: Batch,
            as: 'batch',
            attributes: ['id', 'start_date', 'end_date'],
        }],
        transaction,
    });
}

// ─── Cancellation Preview ─────────────────────────────────────────────────────
/**
 * POST /api/admin/bookings/:tbrId/bookings/:bookingId/cancellation-preview
 *
 * Read-only: calculates what the refund/deduction would be under the booking's
 * cancellation policy without making any changes.
 */
router.post('/:tbrId/bookings/:bookingId/cancellation-preview', async (req, res) => {
    try {
        const { bookingId } = req.params;
        const booking = await findBookingWithBatch(bookingId);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        if (booking.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'Booking is already cancelled' });
        }

        const now        = new Date();
        const trekStart  = new Date(booking.batch?.start_date || Date.now());
        const hoursLeft  = (trekStart - now) / (1000 * 60 * 60);
        const policyType = booking.cancellation_policy_type || 'standard';

        const finalAmount          = parseFloat(booking.final_amount    || 0);
        const advanceAmount        = parseFloat(booking.advance_amount   || 0);
        const platformFees         = parseFloat(booking.platform_fees    || 0);
        const gstAmount            = parseFloat(booking.gst_amount       || 0);
        const insuranceAmount      = parseFloat(booking.insurance_amount || 0);
        const freeCancellationAmt  = parseFloat(booking.free_cancellation_amount || 0);
        const hasFreeCancellation  = freeCancellationAmt > 0;

        let preview;
        if (policyType === 'flexible') {
            preview = calculateFlexibleRefundV2({
                finalAmount,
                platformFees,
                gstAmount,
                insuranceAmount,
                freeCancellationAmount: freeCancellationAmt,
                advanceAmount,
                hasFreeCancellation,
                timeRemainingHours: hoursLeft,
                bookingId,
                policyName: 'Flexible Policy',
            });
        } else {
            preview = calculateStandardRefund({
                trekPrice:        finalAmount,
                trekStartDatetime: trekStart,
                cancellationTime:  now,
                bookingStatus:    booking.status,
            });
        }

        return res.json({
            success: true,
            data: {
                refundAmount:    preview.refund      ?? 0,
                deductionAmount: preview.deduction   ?? 0,
                policyType,
                hoursUntilTrek:  Math.max(0, hoursLeft),
                slabInfo:        preview.slab_info   || null,
                rule:            preview.rule        || null,
                refundItems:     preview.refund_items || [],
                loseItems:       preview.lose_items   || [],
            },
        });
    } catch (error) {
        logger.error('error', 'Error previewing cancellation', { error: error.message, stack: error.stack });
        return res.status(500).json({ success: false, message: 'Failed to preview cancellation' });
    }
});

// ─── Cancel Booking ───────────────────────────────────────────────────────────
/**
 * POST /api/admin/bookings/:tbrId/bookings/:bookingId/cancel
 *
 * Admin-level cancellation — bypasses trek status restrictions.
 * Body: { refundAmount, deductionAmount, reason, mode, vendorShare }
 */
router.post('/:tbrId/bookings/:bookingId/cancel', async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { bookingId }                      = req.params;
        const { refundAmount = 0, deductionAmount = 0, reason = 'Admin cancellation', mode } = req.body;

        const booking = await findBookingWithBatch(bookingId, transaction);

        if (!booking) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        if (booking.status === 'cancelled') {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Booking is already cancelled' });
        }

        const existingCxl = await CancellationBooking.findOne({
            where: { booking_id: bookingId },
            transaction,
        });
        if (existingCxl) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Cancellation record already exists for this booking' });
        }

        // Cancel the booking
        await booking.update({
            status:            'cancelled',
            cancelled_by:      'admin',
            refund_amount:     parseFloat(refundAmount),
            deduction_amount:  parseFloat(deductionAmount),
            cancellation_rule: reason,
        }, { transaction });

        // Reclaim batch slots
        if (booking.batch) {
            await updateBatchSlotsOnCancellation(booking.batch.id, booking.total_travelers, transaction);
        }

        // Persist cancellation record
        const cxlRecord = await CancellationBooking.create({
            booking_id:            bookingId,
            customer_id:           booking.customer_id || null,
            trek_id:               booking.trek_id,
            batch_id:              booking.batch_id || null,
            total_refundable_amount: parseFloat(refundAmount),
            deduction:             parseFloat(deductionAmount),
            reason,
            status:               'pending',
            cancellation_date:     new Date(),
            notes: `Admin cancellation (mode: ${mode || 'MANUAL'})`,
        }, { transaction });

        await transaction.commit();

        return res.json({
            success: true,
            message: 'Booking cancelled successfully',
            data: {
                bookingId,
                cancellationId: `CAN-${String(cxlRecord.id).padStart(2, '0')}`,
                refundAmount:   parseFloat(refundAmount),
                reason,
            },
        });
    } catch (error) {
        await transaction.rollback();
        logger.error('error', 'Error cancelling booking (admin)', { error: error.message, stack: error.stack });
        return res.status(500).json({ success: false, message: 'Failed to cancel booking' });
    }
});

// ─── Pending Balances ─────────────────────────────────────────────────────────
/**
 * GET /api/admin/bookings/pending-balances
 * Returns bookings with outstanding remaining_amount (FLEXIBLE policy focus).
 * Query: policyType, paymentStatus, vendorId, tbrId
 */
router.get('/pending-balances', async (req, res) => {
    try {
        const { policyType, paymentStatus, vendorId, tbrId } = req.query;

        const where = {
            remaining_amount: { [Op.gt]: 0 },
            status: { [Op.in]: ['confirmed', 'pending'] },
        };
        if (policyType)    where.cancellation_policy_type = policyType;
        if (paymentStatus) where.payment_status           = paymentStatus;

        const batchWhere = {};
        if (tbrId) batchWhere.tbr_id = tbrId;

        const trekWhere = {};
        if (vendorId) trekWhere.vendor_id = vendorId;

        const bookings = await Booking.findAll({
            where,
            attributes: BOOKING_ATTRS,
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['id', 'name', 'email', 'phone'],
                    required: false,
                },
                {
                    model: Batch,
                    as: 'batch',
                    attributes: ['id', 'tbr_id', 'start_date', 'end_date'],
                    where: Object.keys(batchWhere).length ? batchWhere : undefined,
                    required: false,
                    include: [{
                        model: Trek,
                        as: 'trek',
                        attributes: ['id', 'title', 'vendor_id'],
                        where: Object.keys(trekWhere).length ? trekWhere : undefined,
                        required: Object.keys(trekWhere).length > 0,
                    }],
                },
            ],
            order: [['createdAt', 'DESC']],
            limit: 200,
        });

        const data = bookings.map(b => ({
            bookingId:        b.id,
            tbrId:            b.batch?.tbr_id || null,
            traveller_name:   b.customer?.name || 'N/A',
            traveller_details: [b.customer?.email, b.customer?.phone].filter(Boolean).join(' | '),
            slots:            b.total_travelers,
            total_amount:     parseFloat(b.final_amount   || 0),
            paid_amount:      parseFloat(b.advance_amount || 0),
            pending_amount:   parseFloat(b.remaining_amount || 0),
            payment_status:   b.payment_status,
            policy_type:      b.cancellation_policy_type,
            created_at:       b.createdAt,
            trek_name:        b.batch?.trek?.title || 'N/A',
            departure_time:   b.batch?.start_date || null,
            arrival_time:     b.batch?.end_date   || null,
        }));

        return res.json({ success: true, data: { count: data.length, bookings: data } });
    } catch (error) {
        logger.error('error', 'Error fetching pending balances', { error: error.message });
        return res.status(500).json({ success: false, message: 'Failed to fetch pending balances' });
    }
});

// ─── Active Bookings ──────────────────────────────────────────────────────────
/**
 * GET /api/admin/bookings/active
 * Returns confirmed bookings for the taxes panel.
 * Query: startDate, endDate, vendorId
 */
router.get('/active', async (req, res) => {
    try {
        const { startDate, endDate, vendorId } = req.query;

        const where = { status: { [Op.in]: ['confirmed', 'pending'] } };

        if (startDate || endDate) {
            where.booking_date = {};
            if (startDate) where.booking_date[Op.gte] = new Date(startDate);
            if (endDate)   where.booking_date[Op.lte] = new Date(endDate);
        }

        const trekWhere = {};
        if (vendorId) trekWhere.vendor_id = vendorId;

        const bookings = await Booking.findAll({
            where,
            attributes: BOOKING_ATTRS,
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['id', 'name'],
                    required: false,
                },
                {
                    model: Batch,
                    as: 'batch',
                    attributes: ['id', 'tbr_id', 'start_date'],
                    required: false,
                    include: [{
                        model: Trek,
                        as: 'trek',
                        attributes: ['id', 'title', 'vendor_id'],
                        where: Object.keys(trekWhere).length ? trekWhere : undefined,
                        required: Object.keys(trekWhere).length > 0,
                        include: [{
                            model: Vendor,
                            as: 'vendor',
                            attributes: ['id', 'business_name'],
                            required: false,
                            include: [{
                                model: require('../../models').User,
                                as: 'user',
                                attributes: ['name'],
                                required: false,
                            }],
                        }],
                    }],
                },
            ],
            order: [['booking_date', 'DESC']],
            limit: 500,
        });

        return res.json({ success: true, data: bookings });
    } catch (error) {
        logger.error('error', 'Error fetching active bookings', { error: error.message });
        return res.status(500).json({ success: false, message: 'Failed to fetch active bookings' });
    }
});

// ─── Booking Summary ──────────────────────────────────────────────────────────
/**
 * GET /api/admin/bookings/summary
 * Aggregated financial summary for the taxes panel.
 * Query: startDate, endDate, vendorId
 */
router.get('/summary', async (req, res) => {
    try {
        const { startDate, endDate, vendorId } = req.query;

        const where = {};
        if (startDate || endDate) {
            where.booking_date = {};
            if (startDate) where.booking_date[Op.gte] = new Date(startDate);
            if (endDate)   where.booking_date[Op.lte] = new Date(endDate);
        }

        const [totals] = await sequelize.query(`
            SELECT
                COUNT(*)                                               AS totalBookings,
                SUM(CASE WHEN status='confirmed' THEN 1 ELSE 0 END)   AS confirmedBookings,
                SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END)   AS cancelledBookings,
                SUM(CASE WHEN status='pending'   THEN 1 ELSE 0 END)   AS pendingBookings,
                SUM(total_amount)                                      AS totalBaseFare,
                SUM(final_amount)                                      AS totalRevenue,
                SUM(advance_amount)                                    AS totalCollected,
                SUM(remaining_amount)                                  AS totalPending,
                SUM(platform_fees)                                     AS totalPlatformFees,
                SUM(gst_amount)                                        AS totalGst,
                SUM(insurance_amount)                                  AS totalInsurance,
                SUM(free_cancellation_amount)                          AS totalFreeCancellation,
                SUM(refund_amount)                                     AS totalRefunds,
                SUM(total_travelers)                                   AS totalTravelers
            FROM bookings
            ${Object.keys(where).length ? 'WHERE booking_date BETWEEN :startDate AND :endDate' : ''}
        `, {
            replacements: {
                startDate: startDate || '2000-01-01',
                endDate:   endDate   || new Date().toISOString(),
            },
            type: sequelize.QueryTypes.SELECT,
        });

        return res.json({ success: true, data: totals });
    } catch (error) {
        logger.error('error', 'Error fetching booking summary', { error: error.message });
        return res.status(500).json({ success: false, message: 'Failed to fetch booking summary' });
    }
});

module.exports = router;
