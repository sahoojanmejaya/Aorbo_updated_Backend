const { Booking, Batch, sequelize } = require('../models');
const commissionService = require('./commissionService');
const logger = require('../utils/logger');

/**
 * Booking Service with Commission Integration
 * Handles booking creation and cancellation with proper commission tracking
 */

class BookingService {
    /**
     * Create booking with commission calculation
     */
    async createBooking(bookingData, dbTransaction = null) {
        const transaction = dbTransaction || await sequelize.transaction();
        const shouldCommit = !dbTransaction;

        try {
            // Calculate commission
            const full_price = parseFloat(bookingData.final_amount || bookingData.amount_paid);
            const commission = commissionService.calculateCommission(full_price);
            const vendor_share_initial = commissionService.calculateVendorShareInitial(full_price, commission);

            // Create booking with commission fields
            const booking = await Booking.create({
                ...bookingData,
                commission_amount: commission,
                vendor_share_initial: vendor_share_initial,
                vendor_share_final: vendor_share_initial, // Initially same
                payment_strategy: bookingData.payment_strategy || 'STANDARD',
            }, { transaction });

            // Process commission in ledger
            await commissionService.processBookingCommission(booking, transaction);

            if (shouldCommit) {
                await transaction.commit();
            }

            logger.info('booking', 'Booking created with commission', {
                booking_id: booking.id,
                full_price,
                commission,
                vendor_share_initial,
            });

            return booking;

        } catch (error) {
            if (shouldCommit) {
                await transaction.rollback();
            }
            
            logger.error('booking', 'Failed to create booking', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Cancel booking with proper refund calculation
     */
    async cancelBooking(bookingId, dbTransaction = null) {
        const transaction = dbTransaction || await sequelize.transaction();
        const shouldCommit = !dbTransaction;

        try {
            // Get booking with batch info
            const booking = await Booking.findByPk(bookingId, {
                include: [
                    {
                        model: Batch,
                        as: 'batch',
                        attributes: ['end_date', 'start_date'],
                    },
                ],
                transaction,
            });

            if (!booking) {
                throw new Error('Booking not found');
            }

            if (booking.status === 'cancelled') {
                throw new Error('Booking already cancelled');
            }

            // Get departure date
            const departure_date = booking.batch?.start_date || new Date();

            // Process cancellation based on payment strategy
            const result = await commissionService.processCancellation(
                booking,
                departure_date,
                transaction
            );

            // Update booking
            await booking.update({
                status: 'cancelled',
                refund_amount: result.refund_amount,
                vendor_share_final: result.vendor_share_final,
                cancelled_at: new Date(),
            }, { transaction });

            if (shouldCommit) {
                await transaction.commit();
            }

            logger.info('booking', 'Booking cancelled', {
                booking_id: bookingId,
                payment_strategy: booking.payment_strategy,
                refund_amount: result.refund_amount,
                vendor_share_final: result.vendor_share_final,
            });

            return {
                booking,
                ...result,
            };

        } catch (error) {
            if (shouldCommit) {
                await transaction.rollback();
            }
            
            logger.error('booking', 'Failed to cancel booking', {
                booking_id: bookingId,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Complete booking (mark as completed)
     */
    async completeBooking(bookingId, dbTransaction = null) {
        const transaction = dbTransaction || await sequelize.transaction();
        const shouldCommit = !dbTransaction;

        try {
            const booking = await Booking.findByPk(bookingId, { transaction });

            if (!booking) {
                throw new Error('Booking not found');
            }

            await booking.update({
                status: 'completed',
                completed_at: new Date(),
            }, { transaction });

            if (shouldCommit) {
                await transaction.commit();
            }

            logger.info('booking', 'Booking completed', {
                booking_id: bookingId,
            });

            return booking;

        } catch (error) {
            if (shouldCommit) {
                await transaction.rollback();
            }
            throw error;
        }
    }
}

module.exports = new BookingService();




