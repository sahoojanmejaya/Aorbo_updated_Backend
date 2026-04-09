const { body } = require("express-validator");
const { 
    Booking, CommissionLog, VendorWallet, Settlement, 
    Vendor, Trek, AuditLog 
} = require("../../models");
const notificationService = require("../../services/notificationService");
const logger = require("../../utils/logger");
const { Op } = require("sequelize");
const { sequelize } = require("../../models");

/**
 * ADMIN SETTLEMENT CONTROLLER
 * Platform controls all vendor payouts
 */

// Validation rules
const triggerSettlementValidation = [
    body("booking_ids").isArray({ min: 1 }).withMessage("Booking IDs required"),
    body("booking_ids.*").isInt().withMessage("Invalid booking ID"),
    body("settlement_date").optional().isISO8601().withMessage("Invalid date")
];

/**
 * Get bookings eligible for settlement
 * GET /admin/settlements/eligible
 */
const getEligibleBookings = async (req, res) => {
    try {
        const { vendor_id, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        // Eligible criteria:
        // 1. status = "completed"
        // 2. payment_status = "full_paid"
        // 3. trek_end_date + 3 days <= today
        // 4. settlement_status = "pending" or null

        const where = {
            status: "completed",
            payment_status: "full_paid",
            settlement_status: { [Op.or]: ["pending", null] }
        };

        if (vendor_id) {
            where.vendor_id = vendor_id;
        }

        const { count, rows: bookings } = await Booking.findAndCountAll({
            where,
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "name"],
                    include: [{
                        model: Batch,
                        as: "batches",
                        where: {
                            end_date: {
                                [Op.lte]: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
                            }
                        },
                        required: true
                    }]
                },
                {
                    model: Vendor,
                    as: "vendor",
                    attributes: ["id", "business_name"]
                },
                {
                    model: CommissionLog,
                    as: "commission_log",
                    where: { status: "pending_settlement" },
                    required: true
                }
            ],
            order: [["created_at", "ASC"]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        // Calculate totals
        const summary = bookings.reduce((acc, booking) => {
            acc.total_amount += parseFloat(booking.final_amount);
            acc.total_commission += parseFloat(booking.commission_log.commission_amount);
            acc.total_vendor_payout += parseFloat(booking.commission_log.vendor_amount);
            return acc;
        }, {
            total_amount: 0,
            total_commission: 0,
            total_vendor_payout: 0,
            booking_count: count
        });

        res.json({
            success: true,
            data: bookings,
            summary,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        logger.error("admin", "Failed to fetch eligible bookings", {
            error: error.message
        });

        res.status(500).json({
            success: false,
            message: "Failed to fetch eligible bookings"
        });
    }
};

/**
 * Trigger settlement for selected bookings
 * POST /admin/settlements/trigger
 */
const triggerSettlement = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
        const { booking_ids, settlement_date = new Date() } = req.body;
        const adminId = req.user.id;

        // Fetch bookings with commission logs
        const bookings = await Booking.findAll({
            where: {
                id: { [Op.in]: booking_ids },
                status: "completed",
                payment_status: "full_paid",
                settlement_status: { [Op.or]: ["pending", null] }
            },
            include: [
                {
                    model: CommissionLog,
                    as: "commission_log",
                    where: { status: "pending_settlement" },
                    required: true
                },
                {
                    model: Vendor,
                    as: "vendor"
                }
            ],
            transaction
        });

        if (bookings.length === 0) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: "No eligible bookings found"
            });
        }

        // Group by vendor
        const vendorSettlements = {};
        for (const booking of bookings) {
            const vendorId = booking.vendor_id;
            if (!vendorSettlements[vendorId]) {
                vendorSettlements[vendorId] = {
                    vendor: booking.vendor,
                    bookings: [],
                    total_amount: 0,
                    total_commission: 0,
                    total_payout: 0
                };
            }
            
            vendorSettlements[vendorId].bookings.push(booking);
            vendorSettlements[vendorId].total_amount += parseFloat(booking.final_amount);
            vendorSettlements[vendorId].total_commission += parseFloat(booking.commission_log.commission_amount);
            vendorSettlements[vendorId].total_payout += parseFloat(booking.commission_log.vendor_amount);
        }

        const settlements = [];

        // Process each vendor settlement
        for (const [vendorId, data] of Object.entries(vendorSettlements)) {
            // Create settlement record
            const settlement = await Settlement.create({
                vendor_id: vendorId,
                booking_ids: data.bookings.map(b => b.id),
                total_amount: data.total_amount,
                commission_amount: data.total_commission,
                payout_amount: data.total_payout,
                settlement_date,
                status: "processed",
                processed_by: adminId,
                processed_at: new Date()
            }, { transaction });

            // Update vendor wallet
            const [wallet] = await VendorWallet.findOrCreate({
                where: { vendor_id: vendorId },
                defaults: {
                    balance: 0,
                    pending_settlement: 0,
                    total_earned: 0
                },
                transaction
            });

            await wallet.update({
                balance: parseFloat(wallet.balance) + data.total_payout,
                pending_settlement: parseFloat(wallet.pending_settlement) - data.total_payout,
                total_earned: parseFloat(wallet.total_earned) + data.total_payout
            }, { transaction });

            // Update bookings
            await Booking.update(
                { settlement_status: "settled", settled_at: new Date() },
                { 
                    where: { id: { [Op.in]: data.bookings.map(b => b.id) } },
                    transaction 
                }
            );

            // Update commission logs
            await CommissionLog.update(
                { status: "settled", settled_at: new Date() },
                {
                    where: { 
                        booking_id: { [Op.in]: data.bookings.map(b => b.id) }
                    },
                    transaction
                }
            );

            // Create audit log
            await AuditLog.create({
                action: "settlement_processed",
                entity_type: "settlement",
                entity_id: settlement.id,
                performed_by_type: "admin",
                performed_by_id: adminId,
                changes: {
                    before: null,
                    after: settlement.toJSON()
                },
                metadata: {
                    vendor_id: vendorId,
                    booking_count: data.bookings.length,
                    payout_amount: data.total_payout
                }
            }, { transaction });

            settlements.push(settlement);

            // Send notification (async after commit)
            setImmediate(async () => {
                try {
                    await notificationService.sendSettlementNotification(
                        vendorId,
                        data.total_payout,
                        data.bookings.map(b => b.id)
                    );
                } catch (error) {
                    logger.error("notification", "Settlement notification failed", {
                        error: error.message,
                        vendorId,
                        settlementId: settlement.id
                    });
                }
            });
        }

        await transaction.commit();

        logger.info("admin", "Settlements processed", {
            adminId,
            settlementCount: settlements.length,
            bookingCount: bookings.length
        });

        res.json({
            success: true,
            message: "Settlements processed successfully",
            data: {
                settlements,
                summary: {
                    vendor_count: Object.keys(vendorSettlements).length,
                    booking_count: bookings.length,
                    total_payout: Object.values(vendorSettlements)
                        .reduce((sum, v) => sum + v.total_payout, 0)
                }
            }
        });
    } catch (error) {
        await transaction.rollback();
        
        logger.error("admin", "Settlement processing failed", {
            error: error.message,
            adminId: req.user.id,
            bookingIds: req.body.booking_ids
        });

        res.status(500).json({
            success: false,
            message: "Failed to process settlements"
        });
    }
};

/**
 * Get settlement history
 * GET /admin/settlements/history
 */
const getSettlementHistory = async (req, res) => {
    try {
        const { vendor_id, page = 1, limit = 20, status } = req.query;
        const offset = (page - 1) * limit;

        const where = {};
        if (vendor_id) where.vendor_id = vendor_id;
        if (status) where.status = status;

        const { count, rows: settlements } = await Settlement.findAndCountAll({
            where,
            include: [
                {
                    model: Vendor,
                    as: "vendor",
                    attributes: ["id", "business_name"]
                }
            ],
            order: [["created_at", "DESC"]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: settlements,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        logger.error("admin", "Failed to fetch settlement history", {
            error: error.message
        });

        res.status(500).json({
            success: false,
            message: "Failed to fetch settlement history"
        });
    }
};

/**
 * Get vendor wallet details
 * GET /admin/settlements/vendor/:vendorId/wallet
 */
const getVendorWallet = async (req, res) => {
    try {
        const vendorId = req.params.vendorId;

        const wallet = await VendorWallet.findOne({
            where: { vendor_id: vendorId },
            include: [
                {
                    model: Vendor,
                    as: "vendor",
                    attributes: ["id", "business_name"]
                }
            ]
        });

        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found"
            });
        }

        // Get pending bookings
        const pendingBookings = await Booking.count({
            where: {
                vendor_id: vendorId,
                status: "completed",
                payment_status: "full_paid",
                settlement_status: { [Op.or]: ["pending", null] }
            }
        });

        res.json({
            success: true,
            data: {
                ...wallet.toJSON(),
                pending_bookings: pendingBookings
            }
        });
    } catch (error) {
        logger.error("admin", "Failed to fetch vendor wallet", {
            error: error.message,
            vendorId: req.params.vendorId
        });

        res.status(500).json({
            success: false,
            message: "Failed to fetch vendor wallet"
        });
    }
};

module.exports = {
    getEligibleBookings,
    triggerSettlement,
    triggerSettlementValidation,
    getSettlementHistory,
    getVendorWallet
};
