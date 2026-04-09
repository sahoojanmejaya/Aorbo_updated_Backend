/**
 * Notification Service
 *
 * Handles vendor notifications for payout events.
 * Email sending is delegated to emailNotificationService (Zoho SMTP via Nodemailer).
 * TODO: wire up actual email dispatch via emailNotificationService once template is ready.
 */

const logger = require('../utils/logger');

class NotificationService {
    /**
     * Notify each vendor whose withdrawals were included in a completed payout batch.
     *
     * @param {Array} withdrawals - Array of Withdrawal model instances (with `.vendor` eager-loaded)
     * @param {object} payout - Payout model instance
     */
    async notifyVendorsPayoutComplete(withdrawals, payout) {
        try {
            // Group by vendor_id
            const vendorMap = {};
            for (const w of withdrawals) {
                if (!vendorMap[w.vendor_id]) {
                    vendorMap[w.vendor_id] = { vendor: w.vendor, totalAmount: 0 };
                }
                vendorMap[w.vendor_id].totalAmount += parseFloat(w.amount || 0);
            }

            for (const [, data] of Object.entries(vendorMap)) {
                await this.sendPayoutNotification(data.vendor, data.totalAmount, payout.batch_id);
            }

            logger.info('notification', 'Payout notifications sent', {
                vendor_count: Object.keys(vendorMap).length,
                batch_id: payout.batch_id,
            });
        } catch (error) {
            logger.error('notification', 'Failed to send payout notifications', {
                error: error.message,
            });
        }
    }

    /**
     * Send payout notification to a single vendor.
     *
     * Email template (TODO: implement via emailNotificationService):
     *   Subject : Payout Processed — ₹{amount}
     *   Body    : Dear {vendor.business_name},
     *             Your payout of ₹{amount} (Batch: {batchId}) has been processed.
     *             Funds will be credited within 2–3 business days.
     *             Thank you for partnering with Aorbo Treks!
     */
    async sendPayoutNotification(vendor, amount, batchId) {
        try {
            // TODO: replace log with actual email dispatch
            // const emailService = require('./emailNotificationService');
            // await emailService.sendPayoutEmail(vendor.email, { amount, batchId, businessName: vendor.business_name });

            logger.info('notification', 'Payout notification queued for vendor', {
                vendor_id: vendor?.id,
                business_name: vendor?.business_name,
                amount,
                batch_id: batchId,
            });
        } catch (error) {
            logger.error('notification', 'Failed to send payout notification', {
                vendor_id: vendor?.id,
                error: error.message,
            });
        }
    }
}

module.exports = new NotificationService();
