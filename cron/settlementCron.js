const cron = require('node-cron');
const settlementService = require('../services/settlementService');
const logger = require('../utils/logger');
const platformConfig = require('../config/platformConfig');

/**
 * Settlement Cron Job
 * Runs daily at midnight IST to process locked → available transitions
 */

class SettlementCron {
    constructor() {
        this.isRunning = false;
    }

    /**
     * Start the cron job
     */
    start() {
        // Run daily at 00:00 IST (midnight)
        // Cron format: minute hour day month dayOfWeek
        // 0 0 * * * = Every day at midnight
        this.job = cron.schedule('0 0 * * *', async () => {
            await this.runSettlement();
        }, {
            timezone: platformConfig.TIMEZONE,
        });

        logger.info('cron', 'Settlement cron job started', {
            schedule: 'Daily at 00:00 IST',
            timezone: platformConfig.TIMEZONE,
        });

        console.log('✅ Settlement cron job started - runs daily at midnight IST');
    }

    /**
     * Stop the cron job
     */
    stop() {
        if (this.job) {
            this.job.stop();
            logger.info('cron', 'Settlement cron job stopped');
            console.log('⏹️  Settlement cron job stopped');
        }
    }

    /**
     * Run settlement process
     */
    async runSettlement() {
        if (this.isRunning) {
            logger.warn('cron', 'Settlement already running, skipping this run');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            logger.info('cron', 'Starting scheduled settlement processing');

            const result = await settlementService.processSettlements();

            const duration = Date.now() - startTime;

            logger.info('cron', 'Scheduled settlement completed', {
                processedCount: result.processedCount,
                totalAmount: result.totalAmount,
                duration: `${duration}ms`,
            });

            console.log(`✅ Settlement processed: ${result.processedCount} batches, total: ₹${result.totalAmount}`);

        } catch (error) {
            logger.error('cron', 'Scheduled settlement failed', {
                error: error.message,
                stack: error.stack,
            });

            console.error('❌ Settlement cron failed:', error.message);

        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Run settlement manually (for testing)
     */
    async runManual() {
        logger.info('cron', 'Manual settlement triggered');
        console.log('🔄 Running manual settlement...');
        await this.runSettlement();
    }
}

module.exports = new SettlementCron();




