const { Batch, Booking, sequelize } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment-timezone');
const platformConfig = require('../config/platformConfig');
// const transactionLedgerService = require('./transactionLedgerService'); // Temporarily disabled
const logger = require('../utils/logger');

/**
 * Settlement Service
 * Handles locked → available fund transitions
 * Runs as cron job (daily at midnight IST)
 */

class SettlementService {
    /**
     * Process settlement for all eligible batches
     * Moves funds from locked to available after settlement period + no disputes
     */
    async processSettlements() {
        try {
            logger.info('settlement', 'Starting settlement processing');

            const settlementDate = moment()
                .tz(platformConfig.TIMEZONE)
                .subtract(platformConfig.SETTLEMENT_PERIOD_DAYS, 'days')
                .startOf('day')
                .toDate();

            // Find all batches that completed before settlement date
            const eligibleBatches = await Batch.findAll({
                where: {
                    end_date: {
                        [Op.lte]: settlementDate,
                    },
                    status: 'completed', // Assuming batch has status
                },
                include: [
                    {
                        model: Booking,
                        as: 'bookings',
                        where: {
                            status: 'completed',
                            dispute_flag: false, // No active disputes
                        },
                        required: false,
                    },
                ],
            });

            let processedCount = 0;
            let totalAmount = 0;

            for (const batch of eligibleBatches) {
                try {
                    const result = await this.settleBatch(batch);
                    if (result.settled) {
                        processedCount++;
                        totalAmount += result.amount;
                    }
                } catch (error) {
                    logger.error('settlement', 'Failed to settle batch', {
                        batch_id: batch.id,
                        tbr_id: batch.tbr_id,
                        error: error.message,
                    });
                    // Continue with other batches
                }
            }

            logger.info('settlement', 'Settlement processing completed', {
                processedCount,
                totalAmount,
            });

            return {
                processedCount,
                totalAmount,
            };

        } catch (error) {
            logger.error('settlement', 'Settlement processing failed', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Settle a specific batch
     * @param {Object} batch
     */
    async settleBatch(batch) {
        const transaction = await sequelize.transaction();

        try {
            // Check if batch has already been settled
            // TODO: Implement transaction ledger service
            // const existingSettlement = await transactionLedgerService.getTransactionHistory(
            //     batch.vendor_id,
            //     {
            //         type: 'DISPUTE_RELEASE',
            //         tbr_id: batch.tbr_id,
            //     }
            // );

            // if (existingSettlement.transactions.length > 0) {
            //     logger.info('settlement', 'Batch already settled', {
            //         batch_id: batch.id,
            //         tbr_id: batch.tbr_id,
            //     });
            //     await transaction.commit();
            //     return { settled: false, reason: 'already_settled' };
            // }

            // Get all completed bookings for this batch without disputes
            const completedBookings = await Booking.findAll({
                where: {
                    batch_id: batch.id,
                    status: 'completed',
                    dispute_flag: false,
                },
                transaction,
            });

            if (completedBookings.length === 0) {
                await transaction.commit();
                return { settled: false, reason: 'no_eligible_bookings' };
            }

            // Calculate total vendor share for this batch
            let totalVendorShare = 0;
            for (const booking of completedBookings) {
                totalVendorShare += parseFloat(booking.vendor_share_final || booking.vendor_share_initial || 0);
            }

            if (totalVendorShare <= 0) {
                await transaction.commit();
                return { settled: false, reason: 'zero_amount' };
            }

            // Create DISPUTE_RELEASE transaction to move from locked to available
            // TODO: Implement transaction ledger service
            // await transactionLedgerService.createTransaction({
            //     vendor_id: batch.vendor_id,
            //     tbr_id: batch.tbr_id,
            //     type: 'DISPUTE_RELEASE',
            //     amount: totalVendorShare,
            //     meta: {
            //         batch_id: batch.id,
            //         settlement_date: new Date(),
            //         booking_count: completedBookings.length,
            //     },
            //     created_by: 'system',
            //     description: `Settlement release for TBR ${batch.tbr_id} (${completedBookings.length} bookings)`,
            // }, transaction);

            // Update wallet balance cache
            // await transactionLedgerService.updateWalletBalanceCache(batch.vendor_id);

            await transaction.commit();

            logger.info('settlement', 'Batch settled successfully', {
                batch_id: batch.id,
                tbr_id: batch.tbr_id,
                vendor_id: batch.vendor_id,
                amount: totalVendorShare,
                booking_count: completedBookings.length,
            });

            return {
                settled: true,
                amount: totalVendorShare,
                booking_count: completedBookings.length,
            };

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Get settlement status for a batch
     * @param {String} tbr_id
     * @param {Number} vendor_id
     */
    async getSettlementStatus(tbr_id, vendor_id) {
        try {
            // TODO: Implement transaction ledger service
            // const settlements = await transactionLedgerService.getTransactionHistory(
            //     vendor_id,
            //     {
            //         type: 'DISPUTE_RELEASE',
            //         tbr_id: tbr_id,
            //     }
            // );

            // if (settlements.transactions.length > 0) {
            //     return {
            //         settled: true,
            //         settlement_date: settlements.transactions[0].created_at,
            //         amount: settlements.transactions[0].amount,
            //     };
            // }

            // Temporary return - settlement not implemented yet
            return {
                settled: false,
                settlement_date: null,
                amount: 0,
            };

        } catch (error) {
            logger.error('settlement', 'Failed to get settlement status', {
                tbr_id,
                vendor_id,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Check if funds are eligible for settlement
     * @param {Date} trek_end_date
     */
    isEligibleForSettlement(trek_end_date) {
        const settlementDate = moment()
            .tz(platformConfig.TIMEZONE)
            .subtract(platformConfig.SETTLEMENT_PERIOD_DAYS, 'days')
            .startOf('day');

        const trekEndMoment = moment(trek_end_date).tz(platformConfig.TIMEZONE);

        return trekEndMoment.isBefore(settlementDate);
    }
}

module.exports = new SettlementService();




