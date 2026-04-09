/**
 * Payout Controller for Admin Panel
 * 
 * @description Handles payout batch operations for administrators
 * @author Kiro AI Assistant
 * @created 2026-03-23
 * 
 * @routes
 * GET    /api/admin/payouts              - Get all payout batches
 * GET    /api/admin/payouts/stats        - Get payout statistics
 * GET    /api/admin/payouts/:id          - Get specific payout batch
 * POST   /api/admin/payouts/run-cycle    - Run payout cycle
 */

const { Payout, Withdrawal, Vendor, User } = require("../../models");
const { Op } = require("sequelize");

/**
 * Get all payout batches with pagination
 * @route GET /api/admin/payouts
 * @access Private (Admin only)
 */
exports.getAllPayouts = async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = {};
        if (status) {
            whereClause.status = status;
        }

        const payouts = await Payout.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [["created_at", "DESC"]],
            include: [
                {
                    model: User,
                    as: "processor",
                    attributes: ["id", "name", "email"],
                    required: false,
                },
            ],
        });

        res.json({
            success: true,
            data: {
                batches: payouts.rows,
                pagination: {
                    total: payouts.count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(payouts.count / limit),
                },
            },
        });
    } catch (error) {
        console.error("Error fetching payouts:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch payouts",
            error: error.message,
        });
    }
};

/**
 * Get payout batch by ID
 * @route GET /api/admin/payouts/:id
 * @access Private (Admin only)
 */
exports.getPayoutById = async (req, res) => {
    try {
        const { id } = req.params;

        const payout = await Payout.findByPk(id, {
            include: [
                {
                    model: User,
                    as: "processor",
                    attributes: ["id", "name", "email"],
                    required: false,
                },
            ],
        });

        if (!payout) {
            return res.status(404).json({
                success: false,
                message: "Payout batch not found",
            });
        }

        res.json({
            success: true,
            data: payout,
        });
    } catch (error) {
        console.error("Error fetching payout:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch payout",
            error: error.message,
        });
    }
};

/**
 * Run payout cycle - Process pending withdrawals
 * @route POST /api/admin/payouts/run-cycle
 * @access Private (Admin only)
 */
exports.runPayoutCycle = async (req, res) => {
    try {
        const { vendor_ids, notes } = req.body;
        const adminUserId = req.user?.id;

        // Get pending withdrawals
        const whereClause = { status: "pending" };
        if (vendor_ids && vendor_ids.length > 0) {
            whereClause.vendor_id = { [Op.in]: vendor_ids };
        }

        const pendingWithdrawals = await Withdrawal.findAll({
            where: whereClause,
            include: [{ model: Vendor, as: "vendor" }],
        });

        if (pendingWithdrawals.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No pending withdrawals found",
            });
        }

        // Calculate totals
        const totalAmount = pendingWithdrawals.reduce(
            (sum, w) => sum + parseFloat(w.amount),
            0
        );
        const vendorCount = new Set(pendingWithdrawals.map(w => w.vendor_id)).size;
        const tbrCount = pendingWithdrawals.reduce(
            (sum, w) => sum + w.tbrs_count,
            0
        );

        // Generate batch ID
        const now = new Date();
        const batchId = `PB-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${Date.now().toString().slice(-3)}`;

        // Create payout batch
        const payout = await Payout.create({
            batch_id: batchId,
            total_amount: totalAmount,
            vendor_count: vendorCount,
            tbr_count: tbrCount,
            status: "processing",
            processed_by: adminUserId,
            notes: notes || `Payout batch created with ${pendingWithdrawals.length} withdrawals`,
        });

        // Update withdrawals to completed
        await Withdrawal.update(
            { status: "completed" },
            { where: { id: { [Op.in]: pendingWithdrawals.map(w => w.id) } } }
        );

        // Mark payout as completed
        await payout.update({
            status: "completed",
            processed_at: new Date(),
        });

        res.json({
            success: true,
            message: "Payout cycle completed successfully",
            data: {
                batch_id: batchId,
                total_amount: totalAmount,
                vendor_count: vendorCount,
                tbr_count: tbrCount,
                withdrawals_processed: pendingWithdrawals.length,
            },
        });
    } catch (error) {
        console.error("Error running payout cycle:", error);
        res.status(500).json({
            success: false,
            message: "Failed to run payout cycle",
            error: error.message,
        });
    }
};

/**
 * Get payout statistics
 * @route GET /api/admin/payouts/stats
 * @access Private (Admin only)
 */
exports.getPayoutStats = async (req, res) => {
    try {
        const totalPayouts = await Payout.count();
        const completedPayouts = await Payout.count({ where: { status: "completed" } });
        const pendingPayouts = await Payout.count({ where: { status: "pending" } });
        
        const totalAmount = await Payout.sum("total_amount", {
            where: { status: "completed" },
        });

        res.json({
            success: true,
            data: {
                total_payouts: totalPayouts,
                completed_payouts: completedPayouts,
                pending_payouts: pendingPayouts,
                total_amount_paid: totalAmount || 0,
            },
        });
    } catch (error) {
        console.error("Error fetching payout stats:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch payout statistics",
            error: error.message,
        });
    }
};
