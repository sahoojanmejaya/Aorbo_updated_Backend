const { TransactionLedger } = require('../models');
const logger = require('../utils/logger');

class TransactionLedgerService {
    /**
     * Create a new ledger transaction and update running balance for the vendor.
     *
     * @param {object} data - { vendor_id, tbr_id?, booking_id?, type, amount, description?, meta?, created_by? }
     * @param {object|null} transaction - Optional Sequelize transaction
     */
    async createTransaction(data, transaction = null) {
        try {
            const { vendor_id, tbr_id, booking_id, type, amount, description, meta, created_by } = data;

            const currentBalance = await this.getVendorBalance(vendor_id);
            let locked_amount = currentBalance.locked;
            let available_amount = currentBalance.available;

            switch (type) {
                case 'BOOKING_LOCK':
                    locked_amount += parseFloat(amount);
                    break;
                case 'DISPUTE_RELEASE':
                    locked_amount -= parseFloat(amount);
                    available_amount += parseFloat(amount);
                    break;
                case 'WITHDRAWAL':
                    available_amount -= parseFloat(amount);
                    break;
                case 'REFUND':
                    locked_amount -= parseFloat(amount);
                    break;
                case 'COMMISSION':
                    available_amount -= parseFloat(amount);
                    break;
                case 'ADJUSTMENT':
                    available_amount += parseFloat(amount);
                    break;
            }

            const balance_before = currentBalance.locked + currentBalance.available;
            const balance_after = locked_amount + available_amount;

            const txn = await TransactionLedger.create(
                {
                    vendor_id,
                    tbr_id,
                    booking_id,
                    type,
                    amount,
                    balance_before,
                    balance_after,
                    locked_amount,
                    available_amount,
                    status: 'completed',
                    description,
                    meta,
                    created_by,
                },
                { transaction }
            );

            logger.info('transaction-ledger', 'Transaction created', {
                id: txn.id,
                vendor_id,
                type,
                amount,
            });

            return txn;
        } catch (error) {
            logger.error('transaction-ledger', 'Failed to create transaction', {
                error: error.message,
                data,
            });
            throw error;
        }
    }

    /**
     * Get the current balance for a vendor from the most recent ledger entry.
     */
    async getVendorBalance(vendor_id) {
        try {
            const lastTxn = await TransactionLedger.findOne({
                where: { vendor_id },
                order: [['created_at', 'DESC']],
            });

            if (!lastTxn) {
                return { locked: 0, available: 0, total: 0 };
            }

            return {
                locked: parseFloat(lastTxn.locked_amount || 0),
                available: parseFloat(lastTxn.available_amount || 0),
                total: parseFloat(lastTxn.balance_after || 0),
            };
        } catch (error) {
            logger.error('transaction-ledger', 'Failed to get vendor balance', {
                vendor_id,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Get transaction history for a vendor with optional filters.
     */
    async getTransactionHistory(vendor_id, filters = {}) {
        try {
            const whereClause = { vendor_id };

            if (filters.type) whereClause.type = filters.type;
            if (filters.tbr_id) whereClause.tbr_id = filters.tbr_id;
            if (filters.booking_id) whereClause.booking_id = filters.booking_id;

            const transactions = await TransactionLedger.findAll({
                where: whereClause,
                order: [['created_at', 'DESC']],
                limit: filters.limit || 100,
            });

            return { transactions, count: transactions.length };
        } catch (error) {
            logger.error('transaction-ledger', 'Failed to get transaction history', {
                vendor_id,
                error: error.message,
            });
            throw error;
        }
    }
}

module.exports = new TransactionLedgerService();
