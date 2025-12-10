const platformConfig = require('../config/platformConfig');
const logger = require('../utils/logger');
const moment = require('moment-timezone');

/**
 * Commission & Cancellation Service
 * Handles commission calculations and cancellation flows
 */

class CommissionService {
    /**
     * Calculate commission for a booking
     * Commission = round(full_price * COMMISSION_PCT)
     * @param {Number} full_price
     * @returns {Number} commission amount
     */
    calculateCommission(full_price) {
        const commission = Math.round(parseFloat(full_price) * platformConfig.COMMISSION_PCT);
        return commission;
    }

    /**
     * Calculate initial vendor share
     * vendor_share_initial = full_price - commission
     * @param {Number} full_price
     * @param {Number} commission
     * @returns {Number} vendor share
     */
    calculateVendorShareInitial(full_price, commission) {
        return parseFloat(full_price) - parseFloat(commission);
    }

    /**
     * Process booking creation with commission
     * @param {Object} booking
     * @param {Object} dbTransaction
     */
    async processBookingCommission(booking, dbTransaction = null) {
        try {
            const full_price = parseFloat(booking.final_amount || booking.amount_paid);
            const commission = this.calculateCommission(full_price);
            const vendor_share_initial = this.calculateVendorShareInitial(full_price, commission);

            // TODO: Transaction ledger removed - booking credit and commission transactions not recorded
            // await transactionLedgerService.createTransaction({
            //     vendor_id: booking.vendor_id,
            //     booking_id: booking.id,
            //     tbr_id: booking.batch?.tbr_id || null,
            //     type: 'BOOKING_CREDIT',
            //     amount: vendor_share_initial,
            //     meta: {
            //         full_price,
            //         commission,
            //         payment_strategy: booking.payment_strategy,
            //     },
            //     description: `Booking payment for booking ${booking.id}`,
            // }, dbTransaction);

            // await transactionLedgerService.createTransaction({
            //     vendor_id: booking.vendor_id,
            //     booking_id: booking.id,
            //     type: 'COMMISSION_DEBIT',
            //     amount: commission,
            //     meta: {
            //         full_price,
            //         commission_pct: platformConfig.COMMISSION_PCT,
            //     },
            //     description: `Platform commission (${platformConfig.COMMISSION_PCT * 100}%) for booking ${booking.id}`,
            // }, dbTransaction);

            logger.info('commission', 'Booking commission processed', {
                booking_id: booking.id,
                full_price,
                commission,
                vendor_share_initial,
            });

            return {
                commission,
                vendor_share_initial,
                vendor_share_final: vendor_share_initial, // Initially same, changes on cancellation
            };

        } catch (error) {
            logger.error('commission', 'Failed to process booking commission', {
                booking_id: booking.id,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Calculate refund amount based on cancellation policy
     * @param {Object} booking
     * @param {Date} cancellation_date
     * @param {Date} departure_date
     * @returns {Number} refund amount
     */
    calculateRefundAmount(booking, cancellation_date, departure_date) {
        // Flexible payments are non-refundable
        if (booking.payment_strategy === 'FLEXIBLE') {
            return 0;
        }

        // Standard payments - calculate based on refund slab
        const full_price = parseFloat(booking.final_amount || booking.amount_paid);
        const days_before_departure = moment(departure_date).diff(moment(cancellation_date), 'days');

        // Find applicable refund slab
        let refund_percentage = 0;
        for (const slab of platformConfig.REFUND_SLABS) {
            if (days_before_departure >= slab.days_before_departure) {
                refund_percentage = slab.refund_percentage;
                break;
            }
        }

        const refund_amount = Math.round(full_price * refund_percentage);
        
        logger.info('commission', 'Refund calculated', {
            booking_id: booking.id,
            days_before_departure,
            refund_percentage,
            refund_amount,
        });

        return refund_amount;
    }

    /**
     * Process cancellation for Standard (Full Pay) booking
     * Formula:
     * 1. customer_refund_amount = based on slab
     * 2. remaining_after_refund = vendor_share_initial - customer_refund_amount
     * 3. vendor_share_final = remaining_after_refund * PLATFORM_CANCELLATION_VENDOR_SHARE_RATIO
     * 4. platform takes the rest
     * 
     * @param {Object} booking
     * @param {Date} departure_date
     * @param {Object} dbTransaction
     */
    async processCancellationStandard(booking, departure_date, dbTransaction = null) {
        try {
            const cancellation_date = new Date();
            const customer_refund = this.calculateRefundAmount(booking, cancellation_date, departure_date);
            const vendor_share_initial = parseFloat(booking.vendor_share_initial);
            
            // Calculate remaining after customer refund
            const remaining_after_refund = vendor_share_initial - customer_refund;
            
            // Vendor gets platform ratio of remaining
            const vendor_share_final = Math.round(
                remaining_after_refund * platformConfig.PLATFORM_CANCELLATION_VENDOR_SHARE_RATIO
            );
            
            // Platform gets the rest
            const platform_share_from_remaining = remaining_after_refund - vendor_share_final;

            // TODO: Transaction ledger removed - refund and adjustment transactions not recorded
            // if (customer_refund > 0) {
            //     await transactionLedgerService.createTransaction({
            //         vendor_id: booking.vendor_id,
            //         booking_id: booking.id,
            //         type: 'REFUND_DEBIT',
            //         amount: customer_refund,
            //         meta: {
            //             refund_percentage: customer_refund / parseFloat(booking.final_amount),
            //             cancellation_date,
            //             departure_date,
            //         },
            //         description: `Customer refund for cancelled booking ${booking.id}`,
            //     }, dbTransaction);
            // }

            // const vendor_loss = vendor_share_initial - vendor_share_final;
            // if (vendor_loss > 0) {
            //     await transactionLedgerService.createTransaction({
            //         vendor_id: booking.vendor_id,
            //         booking_id: booking.id,
            //         type: 'ADMIN_ADJUSTMENT',
            //         amount: -vendor_loss, // Negative adjustment
            //         meta: {
            //             reason: 'cancellation_adjustment',
            //             vendor_share_initial,
            //             customer_refund,
            //             vendor_share_final,
            //             platform_share_from_remaining,
            //         },
            //         description: `Vendor share adjustment for cancellation ${booking.id}`,
            //     }, dbTransaction);
            // }

            logger.info('commission', 'Standard cancellation processed', {
                booking_id: booking.id,
                customer_refund,
                vendor_share_initial,
                vendor_share_final,
                platform_share_from_remaining,
            });

            return {
                customer_refund,
                vendor_share_final,
                refund_amount: customer_refund,
            };

        } catch (error) {
            logger.error('commission', 'Failed to process standard cancellation', {
                booking_id: booking.id,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Process cancellation for Flexible (Partial 999) booking
     * Flexible payments are non-refundable
     * Vendor keeps the amount paid (999)
     * 
     * @param {Object} booking
     * @param {Object} dbTransaction
     */
    async processCancellationFlexible(booking, dbTransaction = null) {
        try {
            // Flexible is non-refundable
            // No transactions needed - vendor keeps the payment
            
            logger.info('commission', 'Flexible cancellation processed (non-refundable)', {
                booking_id: booking.id,
                vendor_keeps: booking.amount_paid,
            });

            return {
                customer_refund: 0,
                vendor_share_final: booking.vendor_share_initial,
                refund_amount: 0,
            };

        } catch (error) {
            logger.error('commission', 'Failed to process flexible cancellation', {
                booking_id: booking.id,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Process booking cancellation (routes to appropriate flow)
     * @param {Object} booking
     * @param {Date} departure_date
     * @param {Object} dbTransaction
     */
    async processCancellation(booking, departure_date, dbTransaction = null) {
        if (booking.payment_strategy === 'STANDARD') {
            return this.processCancellationStandard(booking, departure_date, dbTransaction);
        } else if (booking.payment_strategy === 'FLEXIBLE') {
            return this.processCancellationFlexible(booking, dbTransaction);
        } else {
            throw new Error(`Unknown payment strategy: ${booking.payment_strategy}`);
        }
    }
}

module.exports = new CommissionService();




