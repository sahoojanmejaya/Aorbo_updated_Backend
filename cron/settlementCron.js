const cron = require('node-cron');
const settlementService = require('../services/settlementService');
const logger = require('../utils/logger');
const platformConfig = require('../config/platformConfig');
const { Op } = require('sequelize');

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

// Mark batches as completed when their end_date has passed — runs at 23:45 IST
// Must run before the midnight settlement cron so status = 'completed' rows exist
cron.schedule('45 23 * * *', async () => {
    try {
        logger.info('cron', 'Starting batch completion sweep');
        const { Batch } = require('../models');
        const { Op } = require('sequelize');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [count] = await Batch.update(
            { status: 'completed' },
            {
                where: {
                    end_date: { [Op.lt]: today },
                    status: 'active',
                },
            }
        );

        logger.info('cron', `Batch completion sweep done: ${count} batches marked completed`);
        console.log(`✅ Batch completion sweep: ${count} batches marked completed`);
    } catch (error) {
        logger.error('cron', 'Batch completion sweep failed', { error: error.message });
        console.error('❌ Batch completion sweep failed:', error.message);
    }
}, { timezone: platformConfig.TIMEZONE });

// Daily inventory reconciliation - runs at 2 AM IST
cron.schedule("0 2 * * *", async () => {
    try {
        logger.info("cron", "Starting daily inventory reconciliation...");
        const { Batch } = require("../models");
        const { recalculateBatchSlots } = require("../utils/batchSlotManager");

        const activeBatches = await Batch.findAll({
            where: {
                status: { [Op.in]: ["active", "upcoming"] }
            },
            attributes: ["id"]
        });

        let fixed = 0;
        for (const batch of activeBatches) {
            try {
                await recalculateBatchSlots(batch.id);
                fixed++;
            } catch (err) {
                logger.error("cron", `Failed to recalculate slots for batch ${batch.id}:`, err.message);
            }
        }

        logger.info("cron", `Inventory reconciliation complete. Fixed ${fixed}/${activeBatches.length} batches.`);
    } catch (error) {
        logger.error("cron", "Error in inventory reconciliation cron:", error);
    }
}, { timezone: "Asia/Kolkata" });




