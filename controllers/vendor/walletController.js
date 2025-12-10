const {
    Vendor,
    Booking,
    Batch,
    Trek,
    Customer,
    CancellationBooking,
    IssueReport,
    Withdrawal,
    sequelize,
} = require("../../models");
const { Op } = require("sequelize");
const logger = require("../../utils/logger");
const commissionService = require("../../services/commissionService");
const settlementService = require("../../services/settlementService");
const platformConfig = require("../../config/platformConfig");
const { roundAmount, roundAmountsInObject } = require("../../utils/amountUtils");

/**
 * Get vendor wallet balance and overview
 */
exports.getWalletBalance = async (req, res) => {
    try {
        const vendorId = req.user.id;
        
        logger.info("wallet", "Fetching wallet balance", { vendorId });

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Get vendor details
        const vendor = await Vendor.findByPk(vendorId);
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor not found",
            });
        }

        // Calculate balances directly from bookings and batches
        const balanceData = await calculateBalancesDirectly(vendorId);
        
        // Get last withdrawal date
        const lastWithdrawal = await getLastWithdrawalDate(vendorId);
        const nextWithdrawalDate = calculateNextWithdrawalDate(lastWithdrawal);
        const canWithdrawNow = new Date() >= nextWithdrawalDate;

        // Get analytics data
        const analyticsData = await getWalletAnalytics(vendorId);

        const response = {
            success: true,
            data: {
                ...balanceData,
                lastWithdrawalDate: lastWithdrawal,
                nextWithdrawalDate: nextWithdrawalDate,
                canWithdrawNow: canWithdrawNow,
                analytics: analyticsData,
            },
        };

        logger.info("wallet", "Wallet balance fetched successfully", { 
            vendorId, 
            availableBalance: balanceData.availableBalance,
            totalEarnings: balanceData.totalEarnings 
        });

        res.json(response);

    } catch (error) {
        logger.error("wallet", "Error fetching wallet balance", {
            vendorId: req.user?.id,
            error: error.message,
            stack: error.stack,
        });

        res.status(500).json({
            success: false,
            message: "Failed to fetch wallet balance",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

/**
 * Get vendor transactions with pagination and filters
 */
exports.getWalletTransactions = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const {
            page = 1,
            limit = 20,
            search = "",
            type = "all",
            status = "all",
        } = req.query;

        logger.info("wallet", "Fetching wallet transactions", { 
            vendorId, 
            page, 
            limit, 
            filters: { search, type, status } 
        });

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        const offset = (page - 1) * limit;

        // Build where conditions for bookings
        const whereConditions = { vendor_id: vendorId };
        
        if (status !== "all") {
            whereConditions.payment_status = status;
        }

        // Simple search on booking ID (primary key) for now (to avoid nested association issues)
        if (search && search.trim()) {
            // Extract numeric ID from search term (e.g., "BK-123" -> "123")
            const numericId = search.replace(/[^\d]/g, '');
            if (numericId) {
                whereConditions.id = numericId;
            }
        }

        // Fetch bookings with related data for transaction history
        const { count, rows: bookings } = await Booking.findAndCountAll({
            where: whereConditions,
            attributes: ['id', 'created_at', 'updated_at', 'booking_date', 'final_amount', 'payment_status', 'status'],
            include: [
                {
                    model: Batch,
                    as: 'batch',
                    attributes: ['id', 'tbr_id', 'start_date', 'trek_id'],
                    required: true,
                    where: {
                        '$batch.trek_id$': {
                            [Op.in]: await Trek.findAll({
                                where: { vendor_id: vendorId },
                                attributes: ['id']
                            }).then(treks => treks.map(t => t.id))
                        }
                    }
                }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: offset
        });

        // Get all unique trek IDs from the bookings
        const trekIds = [...new Set(bookings.map(booking => booking.batch?.trek_id).filter(id => id))];
        
        // Fetch trek titles separately
        const treks = await Trek.findAll({
            where: { 
                id: { [Op.in]: trekIds },
                vendor_id: vendorId 
            },
            attributes: ['id', 'title']
        });

        // Create a map of trek_id to trek_title for easy lookup
        const trekNameMap = {};
        treks.forEach(trek => {
            trekNameMap[trek.id] = trek.title;
        });

        // Transform bookings into transaction format
        const transactions = [];
        
        for (const booking of bookings) {
            const trekId = booking.batch?.trek_id;
            const trekName = trekNameMap[trekId] || 'Unknown Trek';
            const tbrId = booking.batch?.tbr_id || 'N/A';
            const paymentStatus = booking.payment_status || 'pending';
            const finalAmount = parseFloat(booking.final_amount || booking.amount_paid || 0);
            const commissionAmount = finalAmount * 0.10; // 10% commission
            
            // Generate description based on payment status
            let paymentDescription = '';
            if (paymentStatus === 'partial') {
                paymentDescription = `Partial payment received for ${trekName}`;
            } else if (paymentStatus === 'full_paid') {
                paymentDescription = `Full payment received for ${trekName}`;
            } else if (paymentStatus === 'full') {
                paymentDescription = `Full payment received for ${trekName}`;
            } else {
                paymentDescription = `Payment received for ${trekName}`;
            }

            // Add payment transaction
            transactions.push({
                id: `BK-${booking.id}`, // Generate booking ID from primary key
                date_time: booking.booking_date || booking.created_at,
                booking_id: `BK-${booking.id}`, // Generate booking ID from primary key
                tbr_id: tbrId,
                amount: roundAmount(finalAmount),
                type: paymentStatus === 'partial' ? 'PartialPayment' : 
                      paymentStatus === 'full' ? 'BookingPayment' : 
                      paymentStatus === 'refunded' ? 'Refund' : 'Payment',
                status: booking.status === 'confirmed' ? 'Success' : 
                        booking.status === 'cancelled' ? 'Failed' : 'Processing',
                description: paymentDescription,
                trek_name: trekName,
                trek_id: trekId,
                payment_status: paymentStatus,
                created_at: booking.booking_date || booking.created_at,
                updated_at: booking.updated_at,
                booking_date: booking.booking_date,
                transaction_date: booking.booking_date || booking.created_at
            });

            // Add commission transaction (only for confirmed bookings with payments)
            if (booking.status === 'confirmed' && finalAmount > 0) {
                transactions.push({
                    id: `BK-${booking.id}`, // Use same booking ID as payment transaction
                    date_time: booking.booking_date || booking.created_at,
                    booking_id: `BK-${booking.id}`, // Generate booking ID from primary key
                    tbr_id: tbrId,
                    amount: roundAmount(-commissionAmount), // Negative amount for commission
                    type: 'Commission',
                    status: 'Success',
                    description: '', // Empty description for commission transactions
                    trek_name: trekName,
                    trek_id: trekId,
                    payment_status: paymentStatus,
                    created_at: booking.booking_date || booking.created_at,
                    updated_at: booking.updated_at,
                    booking_date: booking.booking_date,
                    transaction_date: booking.booking_date || booking.created_at
                });
            }
        }

        // Sort transactions by date (newest first)
        transactions.sort((a, b) => new Date(b.date_time) - new Date(a.date_time));

        // Filter by type if specified
        let filteredTransactions = transactions;
        if (type !== "all") {
            filteredTransactions = transactions.filter(t => t.type === type);
        }

        // Additional search filtering for trek names and TBR IDs (post-processing)
        if (search && search.trim()) {
            const searchTerm = search.toLowerCase();
            filteredTransactions = filteredTransactions.filter(t => 
                t.booking_id.toLowerCase().includes(searchTerm) ||
                t.tbr_id.toLowerCase().includes(searchTerm) ||
                t.trek_name.toLowerCase().includes(searchTerm)
            );
        }

        const totalCount = count;

        const response = {
            success: true,
            data: filteredTransactions,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount: totalCount,
                itemsPerPage: parseInt(limit),
            },
        };

        logger.info("wallet", "Transaction history fetched successfully", { 
            vendorId, 
            count: filteredTransactions.length,
            totalCount 
        });

        res.json(response);

    } catch (error) {
        logger.error("wallet", "Error fetching transaction history", {
            vendorId: req.user?.id,
            error: error.message,
            stack: error.stack,
        });

        res.status(500).json({
            success: false,
            message: "Failed to fetch transaction history",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

/**
 * Create withdrawal request
 */
exports.createWithdrawal = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
        const vendorId = req.user.id;
        const { amount, selectedTbrs } = req.body;

        logger.info("wallet", "Creating withdrawal request", { 
            vendorId, 
            amount, 
            selectedTbrs 
        });

        if (!vendorId) {
            await transaction.rollback();
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Validate withdrawal amount
        const validation = await validateWithdrawalRequest(vendorId, amount, transaction);
        if (!validation.valid) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: validation.message,
                error: validation.error,
            });
        }

        // Generate withdrawal ID
        const withdrawalId = generateWithdrawalId();
        const idempotencyKey = `withdraw-${Date.now()}-${vendorId}-${Math.random().toString(36).substr(2, 9)}`;

        // Create withdrawal record
        const withdrawal = await createWithdrawalRecord({
            vendorId,
            amount,
            withdrawalId,
            idempotencyKey,
            selectedTbrs,
            transaction,
        });

        // Create transaction ledger entry
        await createWithdrawalTransaction({
            vendorId,
            amount,
            withdrawalId,
            transaction,
        });

        // Calculate TBR breakdown
        const tbrBreakdown = await calculateTbrBreakdown(vendorId, amount, selectedTbrs, transaction);

        await transaction.commit();

        const response = {
            success: true,
            message: "Withdrawal request created successfully",
            data: {
                withdrawalId: withdrawal.withdrawal_id,
                amount: roundAmount(withdrawal.amount_requested),
                status: withdrawal.status,
                tbrBreakdown: tbrBreakdown,
                processingTime: "2-3 business days",
            },
        };

        logger.info("wallet", "Withdrawal request created successfully", { 
            vendorId, 
            withdrawalId: withdrawal.withdrawal_id,
            amount 
        });

        res.status(201).json(response);

    } catch (error) {
        await transaction.rollback();
        
        logger.error("wallet", "Error creating withdrawal", {
            vendorId: req.user?.id,
            error: error.message,
            stack: error.stack,
        });

        res.status(500).json({
            success: false,
            message: "Failed to create withdrawal request",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

/**
 * Get withdrawal history
 */
exports.getWithdrawalHistory = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const { page = 1, limit = 10 } = req.query;

        logger.info("wallet", "Fetching withdrawal history", { vendorId, page, limit });

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        const offset = (page - 1) * limit;

        const withdrawals = await getWithdrawalsWithDetails(vendorId, offset, limit);
        const totalCount = await getWithdrawalCount(vendorId);

        const response = {
            success: true,
            data: withdrawals,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount: totalCount,
                itemsPerPage: parseInt(limit),
            },
        };

        logger.info("wallet", "Withdrawal history fetched successfully", { 
            vendorId, 
            count: withdrawals.length 
        });

        res.json(response);

    } catch (error) {
        logger.error("wallet", "Error fetching withdrawal history", {
            vendorId: req.user?.id,
            error: error.message,
            stack: error.stack,
        });

        res.status(500).json({
            success: false,
            message: "Failed to fetch withdrawal history",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

/**
 * Get TBR breakdown for withdrawals
 */
exports.getTbrBreakdown = async (req, res) => {
    try {
        const vendorId = req.user.id;

        logger.info("wallet", "Fetching TBR breakdown", { vendorId });

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        const tbrBreakdown = await getAvailableTbrBreakdown(vendorId);

        const response = {
            success: true,
            data: tbrBreakdown,
        };

        logger.info("wallet", "TBR breakdown fetched successfully", { 
            vendorId, 
            tbrCount: tbrBreakdown.length 
        });

        res.json(response);

    } catch (error) {
        logger.error("wallet", "Error fetching TBR breakdown", {
            vendorId: req.user?.id,
            error: error.message,
            stack: error.stack,
        });

        res.status(500).json({
            success: false,
            message: "Failed to fetch TBR breakdown",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

/**
 * Get locked balance based on trek batches within 2-day window
 * This calculates locked amount for batches starting from (current_date - 2 days) to current_date (inclusive)
 */
exports.getLockedBalanceDetails = async (req, res) => {
    try {
        const vendorId = req.user.id;

        logger.info("wallet", "Fetching locked balance details", { vendorId });

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        const lockedBalanceData = await calculateLockedBalanceForBatches(vendorId);

        const response = {
            success: true,
            data: lockedBalanceData,
        };

        logger.info("wallet", "Locked balance details fetched successfully", { 
            vendorId, 
            totalLockedAmount: lockedBalanceData.totalLockedAmount,
            batchesCount: lockedBalanceData.batches.length
        });

        res.json(response);

    } catch (error) {
        logger.error("wallet", "Error fetching locked balance details", {
            vendorId: req.user?.id,
            error: error.message,
            stack: error.stack,
        });

        res.status(500).json({
            success: false,
            message: "Failed to fetch locked balance details",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

/**
 * Get total earnings details for trek batches with start_date <= current_date
 * Earnings amount per booking = trek_base_price - vendor_discount - coupon_discount - total_refundable_amount(if status = cancelled)
 */
exports.getTotalEarningsDetails = async (req, res) => {
    try {
        const vendorId = req.user.id;

        logger.info("wallet", "Fetching total earnings details", { vendorId });

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        const data = await calculateTotalEarningsForBatches(vendorId);

        res.json({ success: true, data });
    } catch (error) {
        logger.error("wallet", "Error fetching total earnings details", {
            vendorId: req.user?.id,
            error: error.message,
            stack: error.stack,
        });

        res.status(500).json({
            success: false,
            message: "Failed to fetch total earnings details",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

/**
 * Get available balance details for trek batches with start_date <= (current_date - 3 days)
 * Available amount per booking = trek_base_price - vendor_discount - coupon_discount - total_refundable_amount(if status = cancelled)
 */
exports.getAvailableBalanceDetails = async (req, res) => {
    try {
        const vendorId = req.user.id;

        logger.info("wallet", "Fetching available balance details", { vendorId });

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        const data = await calculateAvailableBalanceForBatches(vendorId);

        res.json({ success: true, data });
    } catch (error) {
        logger.error("wallet", "Error fetching available balance details", {
            vendorId: req.user?.id,
            error: error.message,
            stack: error.stack,
        });

        res.status(500).json({
            success: false,
            message: "Failed to fetch available balance details",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

// Helper functions

async function calculateWalletBalances(vendorId) {
    // This would integrate with your actual transaction ledger system
    // For now, using simplified calculation based on bookings
    
    const bookings = await Booking.findAll({
        where: { vendor_id: vendorId },
        include: [
            {
                model: Batch,
                as: "batch",
                attributes: ["start_date", "end_date"],
            },
            {
                model: Trek,
                as: "trek",
                attributes: ["title"],
            },
        ],
    });

    let availableBalance = 0;
    let lockedBalance = 0;
    let pendingRefunds = 0;
    let totalEarnings = 0;

    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    for (const booking of bookings) {
        const bookingAmount = parseFloat(booking.final_amount || 0);
        const commission = parseFloat(booking.commission_amount || 0);
        const vendorShare = bookingAmount - commission;
        
        totalEarnings += vendorShare;

        if (booking.status === "cancelled") {
            // Handle refunds based on cancellation policy
            const refundAmount = calculateRefundAmount(booking);
            pendingRefunds += refundAmount;
        } else if (booking.status === "completed") {
            // Check if 3 days have passed since batch end date
            if (booking.batch && booking.batch.end_date) {
                const batchEndDate = new Date(booking.batch.end_date);
                if (batchEndDate < threeDaysAgo) {
                    availableBalance += vendorShare;
                } else {
                    lockedBalance += vendorShare;
                }
            } else {
                // If no batch date, consider as available
                availableBalance += vendorShare;
            }
        }
    }

    return {
        availableBalance: Math.max(0, availableBalance),
        lockedBalance: Math.max(0, lockedBalance),
        pendingRefunds: Math.max(0, pendingRefunds),
        totalEarnings: Math.max(0, totalEarnings),
    };
}

function calculateRefundAmount(booking) {
    // Implement your cancellation policy logic here
    // For example, 50% refund for Standard bookings
    if (booking.payment_strategy === "STANDARD") {
        return parseFloat(booking.final_amount || 0) * 0.5;
    }
    // Flexible bookings are non-refundable
    return 0;
}

async function getLastWithdrawalDate(vendorId) {
    // This would query your withdrawals table
    // For now, returning null (no previous withdrawals)
    return null;
}

function calculateNextWithdrawalDate(lastWithdrawal) {
    if (!lastWithdrawal) {
        return new Date(); // Can withdraw immediately
    }

    const lastDate = new Date(lastWithdrawal);
    
    // Get the end of the week when last withdrawal was made
    const lastWeekEnd = new Date(lastDate);
    lastWeekEnd.setDate(lastDate.getDate() + (6 - lastDate.getDay())); // Saturday
    lastWeekEnd.setHours(23, 59, 59, 999);

    // Next withdrawal available from next Sunday
    const nextAvailableDate = new Date(lastWeekEnd);
    nextAvailableDate.setDate(lastWeekEnd.getDate() + 1);
    nextAvailableDate.setHours(0, 0, 0, 0);

    return nextAvailableDate;
}

async function getWalletAnalytics(vendorId) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get bookings for different periods
    const [sevenDayBookings, thirtyDayBookings, allBookings] = await Promise.all([
        Booking.findAll({
            where: {
                vendor_id: vendorId,
                created_at: { [Op.gte]: sevenDaysAgo },
            },
        }),
        Booking.findAll({
            where: {
                vendor_id: vendorId,
                created_at: { [Op.gte]: thirtyDaysAgo },
            },
        }),
        Booking.findAll({
            where: { vendor_id: vendorId },
        }),
    ]);

    const calculateMetrics = (bookings) => {
        let earnings = 0;
        let refunds = 0;
        let cancellations = 0;

        for (const booking of bookings) {
            const amount = parseFloat(booking.final_amount || 0);
            const commission = parseFloat(booking.commission_amount || 0);
            const vendorShare = amount - commission;

            if (booking.status === "completed") {
                earnings += vendorShare;
            } else if (booking.status === "cancelled") {
                cancellations += 1;
                const refundAmount = calculateRefundAmount(booking);
                refunds += refundAmount;
            }
        }

        return { earnings, refunds, cancellations };
    };

    const sevenDayMetrics = calculateMetrics(sevenDayBookings);
    const thirtyDayMetrics = calculateMetrics(thirtyDayBookings);

    return {
        "7days": {
            earnings: sevenDayMetrics.earnings,
            refunds: sevenDayMetrics.refunds,
            cancellations: sevenDayMetrics.cancellations,
        },
        "30days": {
            earnings: thirtyDayMetrics.earnings,
            refunds: thirtyDayMetrics.refunds,
            cancellations: thirtyDayMetrics.cancellations,
        },
    };
}

async function validateWithdrawalRequest(vendorId, amount, transaction) {
    // Get current balance
    const balances = await calculateWalletBalances(vendorId);
    
    // Check if amount is valid
    if (!amount || amount <= 0) {
        return {
            valid: false,
            message: "Please enter a valid amount",
            error: "INVALID_AMOUNT",
        };
    }

    // Check if sufficient balance
    if (amount > balances.availableBalance) {
        return {
            valid: false,
            message: `Insufficient balance. Available: ₹${balances.availableBalance.toLocaleString("en-IN")}`,
            error: "INSUFFICIENT_BALANCE",
        };
    }

    // Check weekly withdrawal rule
    const lastWithdrawal = await getLastWithdrawalDate(vendorId);
    const nextWithdrawalDate = calculateNextWithdrawalDate(lastWithdrawal);
    const canWithdrawNow = new Date() >= nextWithdrawalDate;

    if (!canWithdrawNow) {
        return {
            valid: false,
            message: `You can only withdraw once per week. Next withdrawal available on ${nextWithdrawalDate.toLocaleDateString("en-IN")}`,
            error: "WEEKLY_LIMIT_REACHED",
        };
    }

    return { valid: true };
}

function generateWithdrawalId() {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `WD-${timestamp}-${random}`;
}

async function createWithdrawalRecord({ vendorId, amount, withdrawalId, idempotencyKey, selectedTbrs, transaction }) {
    // This would create a record in your withdrawals table
    // For now, returning a mock withdrawal object
    return {
        withdrawal_id: withdrawalId,
        vendor_id: vendorId,
        amount_requested: amount,
        amount_gross: amount,
        amount_fees: 0,
        amount_net: amount,
        status: "REQUESTED",
        initiated_at: new Date(),
        idempotency_key: idempotencyKey,
        per_tbr_breakdown: selectedTbrs || [],
    };
}

async function createWithdrawalTransaction({ vendorId, amount, withdrawalId, transaction }) {
    // This would create a transaction ledger entry
    // For now, just logging
    logger.info("wallet", "Creating withdrawal transaction", {
        vendorId,
        amount,
        withdrawalId,
    });
}

async function calculateTbrBreakdown(vendorId, amount, selectedTbrs, transaction) {
    // This would calculate the actual TBR breakdown
    // For now, returning mock data
    return [
        {
            tbrId: "TBR-001",
            trekName: "Sample Trek",
            grossAmount: amount * 0.6,
            refundsDeducted: 0,
            commissionsDeducted: amount * 0.06,
            netAmount: amount * 0.54,
            totalBookings: 2,
            totalCancellations: 0,
        },
    ];
}

async function getTransactionsWithDetails(whereConditions, offset, limit) {
    // This would query your actual transactions table
    // For now, returning mock data based on bookings
    const bookings = await Booking.findAll({
        where: { vendor_id: whereConditions.vendor_id },
        include: [
            {
                model: Batch,
                as: "batch",
                attributes: ["tbr_id", "start_date", "end_date"],
                required: false,
            },
            {
                model: Trek,
                as: "trek",
                attributes: ["title"],
                required: false,
            },
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [["created_at", "DESC"]],
    });

    return bookings.map((booking, index) => ({
        id: `TXN-${booking.id}`,
        booking_id: booking.id,
        tbr_id: booking.batch?.tbr_id || `TBR-${booking.id}`,
        amount: parseFloat(booking.final_amount || 0),
        is_credit: booking.status === "completed",
        type: booking.status === "completed" ? "BookingPayment" : 
              booking.status === "cancelled" ? "Refund" : "Commission",
        status: booking.status === "completed" ? "Success" : 
                booking.status === "cancelled" ? "Processing" : "Success",
        description: booking.status === "completed" ? 
                    `Payment received for ${booking.trek?.title || "Trek"}` :
                    booking.status === "cancelled" ?
                    `Refund processed for ${booking.trek?.title || "Trek"}` :
                    `Commission for ${booking.trek?.title || "Trek"}`,
        created_at: booking.created_at,
    }));
}

async function getTransactionCount(whereConditions) {
    const count = await Booking.count({
        where: { vendor_id: whereConditions.vendor_id },
    });
    return count;
}

async function getWithdrawalsWithDetails(vendorId, offset, limit) {
    // This would query your actual withdrawals table
    // For now, returning mock data
    return [
        {
            id: "WD-2025-001",
            amount: roundAmount(25000),
            status: "Completed",
            created_at: "2025-01-07T10:00:00Z",
            tbr_breakdown: [
                {
                    tbr_id: "TBR-2025-H01",
                    trek_name: "Himalayan Trek",
                    gross_amount: roundAmount(15000),
                    refunds_deducted: roundAmount(1000),
                    commissions_deducted: roundAmount(1500),
                    net_amount: roundAmount(12500),
                    total_bookings: 5,
                    total_cancellations: 1,
                },
            ],
            failure_reason: null,
        },
    ];
}

async function getWithdrawalCount(vendorId) {
    // This would count actual withdrawals
    return 1;
}

async function getAvailableTbrBreakdown(vendorId) {
    // This would get actual TBR breakdown from your database
    // Get batches through Trek model since Batch doesn't have vendor_id directly
    const batches = await Batch.findAll({
        include: [
            {
                model: Trek,
                as: "trek",
                attributes: ["title", "vendor_id"],
                where: { vendor_id: vendorId },
                required: true,
            },
        ],
        order: [["start_date", "DESC"]],
        limit: 50,
    });

    return batches.map(batch => {
        const mockGrossAmount = Math.random() * 20000 + 5000;
        const mockCommissions = mockGrossAmount * 0.1;
        const mockNetAmount = mockGrossAmount - mockCommissions;

        return {
            tbr_id: batch.tbr_id || `TBR-${batch.id}`,
            trek_name: batch.trek?.title || "Unknown Trek",
            gross_amount: roundAmount(mockGrossAmount),
            refunds_deducted: roundAmount(0),
            commissions_deducted: roundAmount(mockCommissions),
            net_amount: roundAmount(mockNetAmount),
            total_bookings: Math.floor(Math.random() * 10) + 1,
            total_cancellations: Math.floor(Math.random() * 3),
            available_for_withdrawal: mockNetAmount > 0,
        };
    });
}

/**
 * Calculate locked balance for trek batches within 2-day window
 * Logic: Find batches starting from (current_date - 2 days) to current_date (inclusive)
 * Lock amount = total_amount - platform_fees - coupon_discount for each booking
 */
async function calculateLockedBalanceForBatches(vendorId) {
    try {
        // Get current date (today's date)
        const now = new Date();
        
        // Calculate date range: 2 days before to current date (inclusive)
        // Example: If today is 16-10-2025, then range is 14-10-2025 to 16-10-2025
        
        // Calculate end date (today) - format as YYYY-MM-DD
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0'); // Month is 0-based
        const day = String(now.getDate()).padStart(2, '0');
        const endDateStr = `${year}-${month}-${day}`; // Today's date
        
        // Calculate start date (2 days before today)
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - 2); // 2 days before current date
        
        const startYear = startDate.getFullYear();
        const startMonth = String(startDate.getMonth() + 1).padStart(2, '0');
        const startDay = String(startDate.getDate()).padStart(2, '0');
        const startDateStr = `${startYear}-${startMonth}-${startDay}`; // 2 days ago

        logger.info("wallet", "Calculating locked balance for batches", {
            vendorId,
            currentDate: endDateStr,
            startDate: startDateStr,
            endDate: endDateStr,
            startDateStr,
            endDateStr,
            today: endDateStr
        });

        // Find batches within the date range for this vendor
        const batches = await Batch.findAll({
            where: {
                start_date: {
                    [Op.between]: [startDateStr, endDateStr]
                }
            },
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "vendor_id"],
                    where: { vendor_id: vendorId },
                    required: true,
                }
            ],
            order: [["start_date", "ASC"]]
        });

        let totalLockedAmount = 0;
        let totalTravelersOverall = 0;
        const batchDetails = [];

        // For each batch, calculate locked amount from bookings
        for (const batch of batches) {
            // Get all bookings for this batch (including cancelled ones)
            const bookings = await Booking.findAll({
                where: {
                    batch_id: batch.id,
                    vendor_id: vendorId,
                    status: {
                        [Op.in]: ["confirmed", "completed", "cancelled"] // Include cancelled bookings
                    }
                },
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        attributes: ["title", "base_price"] // Include base_price from treks table
                    }
                ]
            });

            // Only include batches that have bookings
            if (bookings.length === 0) {
                continue; // Skip batches with no bookings
            }

            let batchLockedAmount = 0;
            let totalTravelersInBatch = 0;
            const bookingDetails = [];

            // Calculate lock amount for each booking
            for (const booking of bookings) {
                // Lock amount formula: trek_base_price - vendor_discount - coupon_discount
                const trekBasePrice = parseFloat(booking.trek?.base_price || 0);
                const vendorDiscount = parseFloat(booking.vendor_discount || 0);
                const couponDiscount = parseFloat(booking.coupon_discount || 0);
                const totalTravelers = booking.total_travelers || 1;
                
                let lockAmountPerPerson = trekBasePrice - vendorDiscount - couponDiscount;
                let lockAmount = lockAmountPerPerson * totalTravelers;

                let refundableAmount = 0;

                // If booking is cancelled, subtract the refundable amount
                if (booking.status === "cancelled") {
                    // Get cancellation details from cancellation_bookings table
                    const cancellationData = await CancellationBooking.findOne({
                        where: {
                            booking_id: booking.id,
                            trek_id: booking.trek_id,
                            batch_id: booking.batch_id
                        },
                        attributes: ["total_refundable_amount"]
                    });

                    if (cancellationData) {
                        refundableAmount = parseFloat(cancellationData.total_refundable_amount || 0) * totalTravelers;
                        lockAmount -= refundableAmount;
                        
                        logger.info("wallet", "Applied cancellation refund to lock amount", {
                            bookingId: booking.id,
                            batchId: batch.id,
                            trekBasePrice,
                            vendorDiscount,
                            couponDiscount,
                            refundableAmount,
                            totalTravelers,
                            originalLockAmount: (trekBasePrice - vendorDiscount - couponDiscount) * totalTravelers,
                            finalLockAmount: lockAmount
                        });
                    }
                }

                batchLockedAmount += lockAmount;
                totalTravelersInBatch += totalTravelers;

                bookingDetails.push({
                    booking_id: booking.id,
                    customer_id: booking.customer_id,
                    total_travelers: totalTravelers,
                    trek_base_price: trekBasePrice,
                    vendor_discount: vendorDiscount,
                    coupon_discount: couponDiscount,
                    lock_amount_per_person: lockAmountPerPerson,
                    lock_amount_total: lockAmount,
                    status: booking.status,
                    total_refundable_amount: refundableAmount,
                    created_at: booking.created_at
                });
            }

            totalLockedAmount += batchLockedAmount;
            totalTravelersOverall += totalTravelersInBatch;

            batchDetails.push({
                batch_id: batch.id,
                tbr_id: batch.tbr_id,
                trek_id: batch.trek_id,
                trek_title: batch.trek?.title,
                start_date: batch.start_date,
                end_date: batch.end_date,
                locked_amount: batchLockedAmount,
                total_bookings: bookings.length,
                total_travelers: totalTravelersInBatch,
                bookings: bookingDetails
            });
        }

        const result = {
            currentDate: endDateStr, // Today's date in YYYY-MM-DD format
            dateRange: {
                startDate: startDateStr,
                endDate: endDateStr,
                description: "Batches starting from 2 days before to current date (inclusive)",
                note: `Date range: ${startDateStr} to ${endDateStr} (YYYY-MM-DD format) - Shows locked amounts for batches starting between 2 days ago and today`,
                example: `If today is ${endDateStr}, then showing batches from ${startDateStr} to ${endDateStr}`
            },
            totalLockedAmount: totalLockedAmount,
            totalTravelersOverall: totalTravelersOverall,
            batchesCount: batchDetails.length, // Only batches with bookings
            batches: batchDetails,
            calculationFormula: {
                description: "Lock amount = (trek_base_price - vendor_discount - coupon_discount - total_refundable_amount (for cancelled bookings)) * total_travelers",
                explanation: "For each booking in batches within the date range: Active bookings (confirmed/completed) use base formula. Cancelled bookings additionally subtract the total_refundable_amount from cancellation_bookings table. Amount is multiplied by total_travelers. This represents the vendor's actual locked share after accounting for refunds."
            }
        };

        logger.info("wallet", "Locked balance calculation completed", {
            vendorId,
            totalLockedAmount,
            batchesCount: batchDetails.length, // Only batches with bookings
            dateRange: `${startDateStr} to ${endDateStr}`,
            currentDate: endDateStr,
            todayDate: endDateStr
        });

        const roundedResult = roundAmountsInObject(result, [
            "totalLockedAmount",
            "locked_amount",
            "lock_amount_per_person",
            "lock_amount_total",
            "total_refundable_amount",
            "trek_base_price",
            "vendor_discount",
            "coupon_discount"
        ]);

        return roundedResult;

    } catch (error) {
        logger.error("wallet", "Error calculating locked balance for batches", {
            vendorId,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

// Calculate total earnings considering batches with start_date <= current_date
async function calculateTotalEarningsForBatches(vendorId) {
    try {
        // Get current date (today's date)
        const now = new Date();
        
        // Calculate today's date - format as YYYY-MM-DD
        const todayYear = now.getFullYear();
        const todayMonth = String(now.getMonth() + 1).padStart(2, '0');
        const todayDay = String(now.getDate()).padStart(2, '0');
        const todayDateStr = `${todayYear}-${todayMonth}-${todayDay}`; // Today's date

        logger.info("wallet", "Calculating total earnings for batches", {
            vendorId,
            currentDate: todayDateStr,
            description: "Including ALL batches from all past dates to today (all historical data)"
        });

        // Find ALL batches for this vendor (all historical data)
        // Total earnings should include all bookings from all time periods
        const batches = await Batch.findAll({
            where: { 
                start_date: { [Op.lte]: todayDateStr } // Include all batches up to today
            },
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "vendor_id"],
                    where: { vendor_id: vendorId },
                    required: true,
                },
            ],
            order: [["start_date", "ASC"]],
        });

        let totalEarningsAmount = 0;
        let totalTravelersOverall = 0;
        const batchDetails = [];

        for (const batch of batches) {
            const bookings = await Booking.findAll({
                where: {
                    batch_id: batch.id,
                    vendor_id: vendorId,
                    status: { [Op.in]: ["confirmed", "completed", "cancelled"] },
                },
                include: [
                    { model: Trek, as: "trek", attributes: ["title", "base_price"] },
                ],
            });

            if (bookings.length === 0) continue;

            let batchEarningsAmount = 0;
            let totalTravelersInBatch = 0;
            const bookingDetails = [];

            for (const booking of bookings) {
                const trekBasePrice = parseFloat(booking.trek?.base_price || 0);
                const vendorDiscount = parseFloat(booking.vendor_discount || 0);
                const couponDiscount = parseFloat(booking.coupon_discount || 0);
                const totalTravelers = booking.total_travelers || 1;

                let refundableAmount = 0;
                if (booking.status === "cancelled") {
                    const cancellationData = await CancellationBooking.findOne({
                        where: { booking_id: booking.id, trek_id: booking.trek_id, batch_id: booking.batch_id },
                        attributes: ["total_refundable_amount"],
                    });
                    refundableAmount = parseFloat(cancellationData?.total_refundable_amount || 0);
                }

                const earningsAmountPerPerson = trekBasePrice - vendorDiscount - couponDiscount - refundableAmount;
                const earningsAmount = earningsAmountPerPerson * totalTravelers;
                batchEarningsAmount += earningsAmount;
                totalTravelersInBatch += totalTravelers;

                bookingDetails.push({
                    booking_id: booking.id,
                    total_travelers: totalTravelers,
                    trek_base_price: trekBasePrice,
                    vendor_discount: vendorDiscount,
                    coupon_discount: couponDiscount,
                    total_refundable_amount: refundableAmount,
                    earnings_amount_per_person: earningsAmountPerPerson,
                    earnings_amount_total: earningsAmount,
                    status: booking.status,
                });
            }

            totalEarningsAmount += batchEarningsAmount;
            totalTravelersOverall += totalTravelersInBatch;
            batchDetails.push({
                batch_id: batch.id,
                tbr_id: batch.tbr_id,
                trek_id: batch.trek_id,
                trek_title: batch.trek?.title,
                start_date: batch.start_date,
                end_date: batch.end_date,
                earnings_amount: batchEarningsAmount,
                total_bookings: bookings.length,
                total_travelers: totalTravelersInBatch,
                bookings: bookingDetails,
            });
        }

        const result = {
            currentDate: todayDateStr,
            cutoffDate: todayDateStr,
            dateRange: {
                from: "All historical data",
                to: todayDateStr,
                description: "Batches with start_date on or before current date (ALL historical data)",
                note: `Including all batches from all past dates to ${todayDateStr} (all historical data)`,
                example: `If today is ${todayDateStr}, then showing all batches from all past dates to ${todayDateStr}`
            },
            totalEarningsAmount,
            totalTravelersOverall,
            batchesCount: batchDetails.length,
            batches: batchDetails,
            calculationFormula: {
                description: "Earnings amount = (base_price - vendor_discount - coupon_discount - total_refundable_amount(if cancelled)) * total_travelers",
                explanation: "For each booking in ALL batches: Active bookings (confirmed/completed) use base formula. Cancelled bookings additionally subtract the total_refundable_amount. Amount is multiplied by total_travelers. This represents the vendor's total earnings from all historical bookings and should equal Available Balance + Locked Balance."
            },
        };

        return roundAmountsInObject(result, [
            "totalEarningsAmount",
            "earnings_amount",
            "earnings_amount_per_person",
            "total_refundable_amount",
            "trek_base_price",
            "vendor_discount",
            "coupon_discount"
        ]);
    } catch (error) {
        logger.error("wallet", "Error calculating total earnings", { vendorId, error: error.message });
        throw error;
    }
}

// Calculate available balance considering batches with start_date <= cutoffDate (today - 3 days)
async function calculateAvailableBalanceForBatches(vendorId) {
    try {
        // Get current date (today's date)
        const now = new Date();
        
        // Calculate cutoff date (3 days before today)
        // Example: If today is 16-10-2025, then cutoff is 13-10-2025
        // We want all batches from 13-10-2025 and before (all historical data)
        
        // Calculate cutoff date (3 days before today) - format as YYYY-MM-DD
        const cutoffDate = new Date(now);
        cutoffDate.setDate(now.getDate() - 3); // 3 days before current date
        
        const cutoffYear = cutoffDate.getFullYear();
        const cutoffMonth = String(cutoffDate.getMonth() + 1).padStart(2, '0');
        const cutoffDay = String(cutoffDate.getDate()).padStart(2, '0');
        const cutoffDateStr = `${cutoffYear}-${cutoffMonth}-${cutoffDay}`; // 3 days ago
        
        // Calculate today's date for reference
        const todayYear = now.getFullYear();
        const todayMonth = String(now.getMonth() + 1).padStart(2, '0');
        const todayDay = String(now.getDate()).padStart(2, '0');
        const todayDateStr = `${todayYear}-${todayMonth}-${todayDay}`; // Today

        logger.info("wallet", "Calculating available balance for batches", {
            vendorId,
            currentDate: todayDateStr,
            cutoffDate: cutoffDateStr,
            description: `Including all batches from ${cutoffDateStr} and before (all historical data)`
        });

        // Find batches for this vendor with start_date <= cutoff (all historical data)
        const batches = await Batch.findAll({
            where: { start_date: { [Op.lte]: cutoffDateStr } },
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "vendor_id"],
                    where: { vendor_id: vendorId },
                    required: true,
                },
            ],
            order: [["start_date", "ASC"]],
        });

        let totalAvailableAmount = 0;
        let totalTravelersOverall = 0;
        const batchDetails = [];

        for (const batch of batches) {
            const bookings = await Booking.findAll({
                where: {
                    batch_id: batch.id,
                    vendor_id: vendorId,
                    status: { [Op.in]: ["confirmed", "completed", "cancelled"] },
                },
                include: [
                    { model: Trek, as: "trek", attributes: ["title", "base_price"] },
                ],
            });

            if (bookings.length === 0) continue;

            let batchAvailableAmount = 0;
            let totalTravelersInBatch = 0;
            const bookingDetails = [];

            for (const booking of bookings) {
                const trekBasePrice = parseFloat(booking.trek?.base_price || 0);
                const vendorDiscount = parseFloat(booking.vendor_discount || 0);
                const couponDiscount = parseFloat(booking.coupon_discount || 0);
                const totalTravelers = booking.total_travelers || 1;

                let refundableAmount = 0;
                if (booking.status === "cancelled") {
                    const cancellationData = await CancellationBooking.findOne({
                        where: { booking_id: booking.id, trek_id: booking.trek_id, batch_id: booking.batch_id },
                        attributes: ["total_refundable_amount"],
                    });
                    refundableAmount = parseFloat(cancellationData?.total_refundable_amount || 0);
                }

                const availableAmountPerPerson = trekBasePrice - vendorDiscount - couponDiscount - refundableAmount;
                const availableAmount = availableAmountPerPerson * totalTravelers;
                batchAvailableAmount += availableAmount;
                totalTravelersInBatch += totalTravelers;

                bookingDetails.push({
                    booking_id: booking.id,
                    total_travelers: totalTravelers,
                    trek_base_price: trekBasePrice,
                    vendor_discount: vendorDiscount,
                    coupon_discount: couponDiscount,
                    total_refundable_amount: refundableAmount,
                    available_amount_per_person: availableAmountPerPerson,
                    available_amount_total: availableAmount,
                    status: booking.status,
                });
            }

            totalAvailableAmount += batchAvailableAmount;
            totalTravelersOverall += totalTravelersInBatch;
            batchDetails.push({
                batch_id: batch.id,
                tbr_id: batch.tbr_id,
                trek_id: batch.trek_id,
                trek_title: batch.trek?.title,
                start_date: batch.start_date,
                end_date: batch.end_date,
                available_amount: batchAvailableAmount,
                total_bookings: bookings.length,
                total_travelers: totalTravelersInBatch,
                bookings: bookingDetails,
            });
        }

        const result = {
            currentDate: todayDateStr,
            cutoffDate: cutoffDateStr,
            dateRange: {
                from: "All historical data",
                to: cutoffDateStr,
                description: "Batches with start_date on or before cutoff date (today - 3 days)",
                note: `Including all batches from ${cutoffDateStr} and before (all historical data)`,
                example: `If today is ${todayDateStr}, then showing all batches from ${cutoffDateStr} and before`
            },
            totalAvailableAmount,
            totalTravelersOverall,
            batchesCount: batchDetails.length,
            batches: batchDetails,
            calculationFormula: {
                description: "Available amount = (base_price - vendor_discount - coupon_discount - total_refundable_amount(if cancelled)) * total_travelers",
                explanation: "For each booking in batches that started 3+ days ago: Active bookings (confirmed/completed) use base formula. Cancelled bookings additionally subtract the total_refundable_amount. Amount is multiplied by total_travelers. This represents the vendor's available balance from historical bookings."
            },
        };

        return roundAmountsInObject(result, [
            "totalAvailableAmount",
            "available_amount",
            "available_amount_per_person",
            "total_refundable_amount",
            "trek_base_price",
            "vendor_discount",
            "coupon_discount"
        ]);
    } catch (error) {
        logger.error("wallet", "Error calculating available balance", { vendorId, error: error.message });
        throw error;
    }
}

/**
 * Get pending refunds details for vendor
 * @route   GET /api/vendor/wallet/pending-refunds-details
 * @desc    Get pending refunds based on disputed amounts in issue_reports
 * @access  Private (Vendor)
 */
const getPendingRefundsDetails = async (req, res) => {
    try {
        const vendorId = req.user.id;

        logger.info("wallet", "Getting pending refunds details", { vendorId });

        const pendingRefundsData = await calculatePendingRefundsForVendor(vendorId);

        res.json({
            success: true,
            data: pendingRefundsData,
        });
    } catch (error) {
        logger.error("wallet", "Error getting pending refunds details", {
            vendorId: req.user?.id,
            error: error.message,
        });
        res.status(500).json({
            success: false,
            message: "Failed to get pending refunds details",
            error: error.message,
        });
    }
};

/**
 * Calculate pending refunds for a vendor based on issue_reports disputed amounts
 * @param {number} vendorId - Vendor ID
 * @returns {Object} Pending refunds data
 */
async function calculatePendingRefundsForVendor(vendorId) {
    try {
        const currentDate = new Date();

        logger.info("wallet", "Calculating pending refunds for vendor", {
            vendorId,
            currentDate: currentDate.toISOString(),
        });

        // First, let's check all issue reports for this vendor to see disputed_amount values
        const allIssueReports = await IssueReport.findAll({
            include: [
                {
                    model: Booking,
                    as: "booking",
                    where: { vendor_id: vendorId },
                    required: true,
                },
            ],
            order: [["created_at", "DESC"]],
        });

        logger.info("wallet", "All issue reports for vendor (before filtering)", {
            vendorId,
            allIssueReportsCount: allIssueReports.length,
            allIssueReports: allIssueReports.map(ir => ({
                id: ir.id,
                disputed_amount: ir.disputed_amount,
                disputed_amount_type: typeof ir.disputed_amount,
                booking_id: ir.booking_id,
            }))
        });

        // Get issue reports with favour_status = 'No Action' for this vendor's bookings
        const issueReports = await IssueReport.findAll({
            where: {
                favoue_status: 'No Action'
            },
            include: [
                {
                    model: Booking,
                    as: "booking",
                    where: { vendor_id: vendorId },
                    required: true,
                    include: [
                        {
                            model: Trek,
                            as: "trek",
                            attributes: ["id", "title", "base_price"],
                        },
                        {
                            model: Batch,
                            as: "batch",
                            attributes: ["id", "tbr_id", "start_date", "end_date"],
                        },
                    ],
                },
            ],
            order: [["created_at", "DESC"]],
        });

        logger.info("wallet", "Found issue reports with favour_status = 'No Action'", {
            vendorId,
            issueReportsCount: issueReports.length,
            issueReports: issueReports.map(ir => ({
                id: ir.id,
                disputed_amount: ir.disputed_amount,
                disputed_amount_type: typeof ir.disputed_amount,
                booking_id: ir.booking_id,
                vendor_id: ir.booking?.vendor_id,
                status: ir.status,
                issue_type: ir.issue_type,
                favoue_status: ir.favoue_status
            }))
        });

        let totalPendingRefunds = 0;
        let totalTravelersOverall = 0;
        const refundDetails = [];

        for (const issueReport of issueReports) {
            const booking = issueReport.booking;
            const trekBasePrice = parseFloat(booking.trek?.base_price || 0);
            const vendorDiscount = parseFloat(booking.vendor_discount || 0);
            const couponDiscount = parseFloat(booking.coupon_discount || 0);
            const totalTravelers = booking.total_travelers || 0;

            const disputedAmount = parseFloat(issueReport.disputed_amount || 0);
            if (!Number.isFinite(disputedAmount) || disputedAmount <= 0) {
                // Even if disputed amount is non-positive, include traveller count but skip adding to pending refunds
                totalTravelersOverall += totalTravelers;
                refundDetails.push({
                    issue_report_id: issueReport.id,
                    dispute_id: `DISP${issueReport.id.toString().padStart(3, '0')}`,
                    booking_id: booking.id,
                    total_travelers: totalTravelers,
                    trek_title: booking.trek?.title,
                    batch_tbr_id: booking.batch?.tbr_id,
                    batch_start_date: booking.batch?.start_date,
                    disputed_amount: disputedAmount,
                    trek_base_price: trekBasePrice,
                    vendor_discount: vendorDiscount,
                    coupon_discount: couponDiscount,
                    booking_status: booking.status,
                    total_refundable_amount: 0,
                    pending_refund_amount_per_person: 0,
                    pending_refund_amount_total: 0,
                    issue_type: issueReport.issue_type,
                    issue_category: issueReport.issue_category,
                    status: issueReport.status,
                    priority: issueReport.priority,
                    created_at: issueReport.created_at,
                });
                continue;
            }

            const pendingRefundAmountTotal = disputedAmount;
            const pendingRefundAmountPerPerson = totalTravelers > 0
                ? pendingRefundAmountTotal / totalTravelers
                : pendingRefundAmountTotal;

            totalPendingRefunds += pendingRefundAmountTotal;
            totalTravelersOverall += totalTravelers;

            refundDetails.push({
                issue_report_id: issueReport.id,
                dispute_id: `DISP${issueReport.id.toString().padStart(3, '0')}`,
                booking_id: booking.id,
                total_travelers: totalTravelers,
                trek_title: booking.trek?.title,
                batch_tbr_id: booking.batch?.tbr_id,
                batch_start_date: booking.batch?.start_date,
                disputed_amount: disputedAmount,
                trek_base_price: trekBasePrice,
                vendor_discount: vendorDiscount,
                coupon_discount: couponDiscount,
                booking_status: booking.status,
                total_refundable_amount: 0,
                pending_refund_amount_per_person: pendingRefundAmountPerPerson,
                pending_refund_amount_total: pendingRefundAmountTotal,
                issue_type: issueReport.issue_type,
                issue_category: issueReport.issue_category,
                status: issueReport.status,
                priority: issueReport.priority,
                created_at: issueReport.created_at,
            });
        }

        logger.info("wallet", "Pending refunds calculation completed", {
            vendorId,
            totalPendingRefunds,
            disputesCount: refundDetails.length,
            refundDetails: refundDetails.map(rd => ({
                dispute_id: rd.dispute_id,
                disputed_amount: rd.disputed_amount,
                pending_refund_amount: rd.pending_refund_amount_total
            }))
        });

        const result = {
            currentDate: currentDate.toISOString(),
            description: "Pending refunds based on disputed amounts (favour_status: 'No Action') in issue_reports",
            totalPendingRefunds,
            totalTravelersOverall,
            disputesCount: refundDetails.length,
            disputes: refundDetails,
            calculationFormula: {
                description: "Pending refund = Sum of disputed_amount for issue_reports where favour_status = 'No Action'",
            },
        };

        return roundAmountsInObject(result, [
            "totalPendingRefunds",
            "trek_base_price",
            "vendor_discount",
            "coupon_discount",
            "total_refundable_amount",
            "pending_refund_amount_per_person",
            "pending_refund_amount_total"
        ]);
    } catch (error) {
        logger.error("wallet", "Error calculating pending refunds", { 
            vendorId, 
            error: error.message 
        });
        throw error;
    }
}

/**
 * Get analytics & insights data for vendor
 * @route   GET /api/vendor/wallet/analytics-insights
 * @desc    Get Total Earnings, Total Refunds, and Cancellations with time filtering
 * @access  Private (Vendor)
 * @query   period: 7days, 30days, yearly
 */
const getAnalyticsInsights = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const { period = '7days' } = req.query;

        logger.info("wallet", "Getting analytics insights", { vendorId, period });

        const analyticsData = await calculateAnalyticsInsights(vendorId, period);

        res.json({
            success: true,
            data: analyticsData,
        });
    } catch (error) {
        logger.error("wallet", "Error getting analytics insights", {
            vendorId: req.user?.id,
            error: error.message,
        });
        res.status(500).json({
            success: false,
            message: "Failed to get analytics insights",
            error: error.message,
        });
    }
};

/**
 * Calculate analytics insights for a vendor with time filtering
 * @param {number} vendorId - Vendor ID
 * @param {string} period - Time period (7days, 30days, yearly)
 * @returns {Object} Analytics data
 */
async function calculateAnalyticsInsights(vendorId, period) {
    try {
        const currentDate = new Date();
        let startDate, endDate;

        // Calculate date range based on period
        switch (period) {
            case '7days':
                startDate = new Date(currentDate);
                startDate.setDate(currentDate.getDate() - 7);
                endDate = currentDate;
                break;
            case '30days':
                startDate = new Date(currentDate);
                startDate.setDate(currentDate.getDate() - 30);
                endDate = currentDate;
                break;
            case 'yearly':
                startDate = new Date(currentDate);
                startDate.setFullYear(currentDate.getFullYear() - 1);
                endDate = currentDate;
                break;
            default:
                startDate = new Date(currentDate);
                startDate.setDate(currentDate.getDate() - 7);
                endDate = currentDate;
        }

        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        logger.info("wallet", "Calculating analytics insights", {
            vendorId,
            period,
            startDate: startDateStr,
            endDate: endDateStr,
            currentDate: currentDate.toISOString(),
            startDateObj: startDate.toISOString(),
            endDateObj: endDate.toISOString()
        });

        // 1. Total Earnings (same logic as total-earnings-details)
        const totalEarnings = await calculateTotalEarningsForPeriod(vendorId, startDateStr, endDateStr);

        // 2. Total Refunds (from issue_reports with disputed_amount > 0)
        const totalRefunds = await calculateTotalRefundsForPeriod(vendorId, startDateStr, endDateStr);

        // 3. Cancellations (count of cancelled bookings)
        const cancellations = await calculateCancellationsForPeriod(vendorId, startDateStr, endDateStr);

        return {
            period,
            dateRange: {
                startDate: startDateStr,
                endDate: endDateStr,
            },
            totalEarnings: {
                amount: roundAmount(totalEarnings.totalAmount || 0),
                count: totalEarnings.bookingsCount,
                description: `Total earnings from batches with start_date between ${startDateStr} and ${endDateStr}`
            },
            totalRefunds: {
                amount: roundAmount(totalRefunds.totalAmount || 0),
                count: totalRefunds.disputesCount,
                description: `Total refunds from issue_reports created between ${startDateStr} and ${endDateStr}`
            },
            cancellations: {
                count: cancellations.count,
                description: `Total cancelled bookings created between ${startDateStr} and ${endDateStr}`
            },
            calculatedAt: currentDate.toISOString(),
        };
    } catch (error) {
        logger.error("wallet", "Error calculating analytics insights", { 
            vendorId, 
            period,
            error: error.message 
        });
        throw error;
    }
}

/**
 * Calculate total earnings for a specific period
 */
async function calculateTotalEarningsForPeriod(vendorId, startDate, endDate) {
    try {
        // Find batches for this vendor within the date range
        const batches = await Batch.findAll({
            where: { 
                start_date: { 
                    [Op.between]: [startDate, endDate] 
                } 
            },
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "vendor_id"],
                    where: { vendor_id: vendorId },
                    required: true,
                },
            ],
            order: [["start_date", "ASC"]],
        });

        logger.info("wallet", "Total Earnings calculation", {
            vendorId,
            startDate,
            endDate,
            batchesFound: batches.length,
            batches: batches.map(b => ({
                id: b.id,
                start_date: b.start_date,
                trek_title: b.trek?.title
            }))
        });

        // Debug: Check if we're getting the same data for all periods
        console.log(`🔍 DEBUG Total Earnings - Period: ${startDate} to ${endDate}`);
        console.log(`📊 Found ${batches.length} batches`);
        if (batches.length > 0) {
            console.log(`📅 Sample batch dates:`, batches.slice(0, 3).map(b => b.start_date));
        }

        let totalAmount = 0;
        let bookingsCount = 0;

        for (const batch of batches) {
            const bookings = await Booking.findAll({
                where: {
                    batch_id: batch.id,
                    vendor_id: vendorId,
                    status: { [Op.in]: ["confirmed", "completed", "cancelled"] },
                },
                include: [
                    { model: Trek, as: "trek", attributes: ["title", "base_price"] },
                ],
            });

            for (const booking of bookings) {
                const trekBasePrice = parseFloat(booking.trek?.base_price || 0);
                const vendorDiscount = parseFloat(booking.vendor_discount || 0);
                const couponDiscount = parseFloat(booking.coupon_discount || 0);

                let refundableAmount = 0;
                if (booking.status === "cancelled") {
                    const cancellationData = await CancellationBooking.findOne({
                        where: { 
                            booking_id: booking.id, 
                            trek_id: booking.trek_id, 
                            batch_id: booking.batch_id 
                        },
                        attributes: ["total_refundable_amount"],
                    });
                    refundableAmount = parseFloat(cancellationData?.total_refundable_amount || 0);
                }

                const earningsAmount = trekBasePrice - vendorDiscount - couponDiscount - refundableAmount;
                totalAmount += earningsAmount;
                bookingsCount++;
            }
        }

        return { totalAmount: roundAmount(totalAmount), bookingsCount };
    } catch (error) {
        logger.error("wallet", "Error calculating total earnings for period", { vendorId, startDate, endDate, error: error.message });
        throw error;
    }
}

/**
 * Calculate total refunds for a specific period
 */
async function calculateTotalRefundsForPeriod(vendorId, startDate, endDate) {
    try {
        const issueReports = await IssueReport.findAll({
            where: {
                disputed_amount: {
                    [Op.gt]: 0, // Only disputed amounts > 0
                },
                created_at: {
                    [Op.between]: [startDate, endDate]
                }
            },
            include: [
                {
                    model: Booking,
                    as: "booking",
                    where: { vendor_id: vendorId },
                    required: true,
                },
            ],
        });

        logger.info("wallet", "Total Refunds calculation", {
            vendorId,
            startDate,
            endDate,
            issueReportsFound: issueReports.length,
            issueReports: issueReports.map(ir => ({
                id: ir.id,
                disputed_amount: ir.disputed_amount,
                created_at: ir.created_at
            }))
        });

        // Debug: Check refunds data
        console.log(`🔍 DEBUG Total Refunds - Period: ${startDate} to ${endDate}`);
        console.log(`📊 Found ${issueReports.length} issue reports`);
        if (issueReports.length > 0) {
            console.log(`📅 Sample issue report dates:`, issueReports.slice(0, 3).map(ir => ir.created_at));
        }

        let totalAmount = 0;
        const disputesCount = issueReports.length;

        for (const issueReport of issueReports) {
            totalAmount += parseFloat(issueReport.disputed_amount || 0);
        }

        return { totalAmount: roundAmount(totalAmount), disputesCount };
    } catch (error) {
        logger.error("wallet", "Error calculating total refunds for period", { vendorId, startDate, endDate, error: error.message });
        throw error;
    }
}

/**
 * Calculate cancellations for a specific period
 */
async function calculateCancellationsForPeriod(vendorId, startDate, endDate) {
    try {
        const cancelledBookings = await Booking.findAll({
            where: {
                vendor_id: vendorId,
                status: "cancelled",
                created_at: {
                    [Op.between]: [startDate, endDate]
                }
            },
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["title"],
                },
                {
                    model: Batch,
                    as: "batch",
                    attributes: ["tbr_id", "start_date"],
                },
            ],
        });

        logger.info("wallet", "Cancellations calculation", {
            vendorId,
            startDate,
            endDate,
            cancelledBookingsFound: cancelledBookings.length,
            cancelledBookings: cancelledBookings.map(cb => ({
                id: cb.id,
                status: cb.status,
                created_at: cb.created_at,
                trek_title: cb.trek?.title
            }))
        });

        // Debug: Check cancellations data
        console.log(`🔍 DEBUG Cancellations - Period: ${startDate} to ${endDate}`);
        console.log(`📊 Found ${cancelledBookings.length} cancelled bookings`);
        if (cancelledBookings.length > 0) {
            console.log(`📅 Sample booking dates:`, cancelledBookings.slice(0, 3).map(b => b.created_at));
        }

        return { count: cancelledBookings.length };
    } catch (error) {
        logger.error("wallet", "Error calculating cancellations for period", { vendorId, startDate, endDate, error: error.message });
        throw error;
    }
}

/**
 * Get analytics insights for 7 days
 * @route   GET /api/vendor/wallet/analytics-7days
 * @desc    Get Total Earnings, Total Refunds, and Cancellations for last 7 days
 * @access  Private (Vendor)
 */
const getAnalytics7Days = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const currentDate = new Date();
        const startDate = new Date(currentDate);
        startDate.setDate(currentDate.getDate() - 7);
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = currentDate.toISOString().split('T')[0];

        logger.info("wallet", "Getting 7 days analytics", { vendorId, startDateStr, endDateStr });

        // 1. TOTAL EARNINGS - Filter by batch start_date for last 7 days
        const batches7Days = await Batch.findAll({
            where: { 
                start_date: { 
                    [Op.between]: [startDateStr, endDateStr] 
                } 
            },
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "vendor_id"],
                    where: { vendor_id: vendorId },
                    required: true,
                },
            ],
            order: [["start_date", "ASC"]],
        });

        // Debug: Check what batches we're getting for 7 days

        // if (batches7Days.length > 0) {
        //     console.log(`📅 Batch dates:`, batches7Days.map(b => ({
        //         id: b.id,
        //         start_date: b.start_date,
        //         trek_title: b.trek?.title
        //     })));
        // }

        let totalEarningsAmount = 0;
        let totalEarningsCount = 0;

        for (const batch of batches7Days) {
            const bookings = await Booking.findAll({
                where: {
                    batch_id: batch.id,
                    vendor_id: vendorId,
                    status: { [Op.in]: ["confirmed", "completed", "cancelled"] },
                },
                include: [
                    { model: Trek, as: "trek", attributes: ["title", "base_price"] },
                ],
            });

            for (const booking of bookings) {
                const trekBasePrice = parseFloat(booking.trek?.base_price || 0);
                const vendorDiscount = parseFloat(booking.vendor_discount || 0);
                const couponDiscount = parseFloat(booking.coupon_discount || 0);

                let refundableAmount = 0;
                if (booking.status === "cancelled") {
                    const cancellationData = await CancellationBooking.findOne({
                        where: { 
                            booking_id: booking.id, 
                            trek_id: booking.trek_id, 
                            batch_id: booking.batch_id 
                        },
                        attributes: ["total_refundable_amount"],
                    });
                    refundableAmount = parseFloat(cancellationData?.total_refundable_amount || 0);
                }

                const earningsAmount = trekBasePrice - vendorDiscount - couponDiscount - refundableAmount;
                totalEarningsAmount += earningsAmount;
                totalEarningsCount++;
            }
        }

        // 2. TOTAL REFUNDS - Filter by issue_reports created_at for last 7 days
        // Only include refunds where favour_status is 'Adjustment' or 'Customer Favour'
        const issueReports7Days = await IssueReport.findAll({
            where: {
                disputed_amount: { [Op.gt]: 0 },
                created_at: { [Op.between]: [startDateStr, endDateStr] },
                favoue_status: { [Op.in]: ['Adjustment', 'Customer Favour'] }
            },
            include: [
                {
                    model: Booking,
                    as: "booking",
                    attributes: ["vendor_id"],
                    where: { vendor_id: vendorId },
                    required: true,
                },
            ],
        });

        let totalRefundsAmount = 0;
        for (const issueReport of issueReports7Days) {
            const favourAmount = parseFloat(issueReport.favour_amount || 0);
            totalRefundsAmount += Number.isFinite(favourAmount) && favourAmount > 0
                ? favourAmount
                : parseFloat(issueReport.disputed_amount || 0);
        }

        // 3. CANCELLATIONS - Filter by cancellation_bookings cancellation_date for last 7 days
        const cancellations7Days = await CancellationBooking.findAll({
            where: {
                cancellation_date: { [Op.between]: [startDateStr, endDateStr] }
            },
            include: [
                {
                    model: Booking,
                    as: "booking",
                    attributes: ["vendor_id"],
                    where: { vendor_id: vendorId },
                    required: true,
                },
            ],
        });

        const roundedTotalEarnings = roundAmount(totalEarningsAmount);
        const roundedTotalRefunds = roundAmount(totalRefundsAmount);

        res.json({
            success: true,
            data: {
                period: "7days",
                dateRange: { startDate: startDateStr, endDate: endDateStr },
                totalEarnings: {
                    amount: roundedTotalEarnings,
                    count: totalEarningsCount,
                    description: `Total earnings from batches with start_date between ${startDateStr} and ${endDateStr}`
                },
                totalRefunds: {
                    amount: roundedTotalRefunds,
                    count: issueReports7Days.length,
                    description: `Total refunds (favour_amount) from issue_reports (favour_status: Adjustment or Customer Favour) created between ${startDateStr} and ${endDateStr}`
                },
                cancellations: {
                    count: cancellations7Days.length,
                    description: `Total cancelled bookings with cancellation_date between ${startDateStr} and ${endDateStr}`
                },
                calculatedAt: currentDate.toISOString(),
            }
        });
    } catch (error) {
        logger.error("wallet", "Error getting 7 days analytics", { vendorId: req.user?.id, error: error.message });
        res.status(500).json({ success: false, message: "Failed to get 7 days analytics", error: error.message });
    }
};

/**
 * Get analytics insights for 30 days
 * @route   GET /api/vendor/wallet/analytics-30days
 * @desc    Get Total Earnings, Total Refunds, and Cancellations for last 30 days
 * @access  Private (Vendor)
 */
const getAnalytics30Days = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const currentDate = new Date();
        const startDate = new Date(currentDate);
        startDate.setDate(currentDate.getDate() - 30);
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = currentDate.toISOString().split('T')[0];

        logger.info("wallet", "Getting 30 days analytics", { vendorId, startDateStr, endDateStr });

        // 1. TOTAL EARNINGS - Filter by batch start_date for last 30 days
        const batches30Days = await Batch.findAll({
            where: { 
                start_date: { 
                    [Op.between]: [startDateStr, endDateStr] 
                } 
            },
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "vendor_id"],
                    where: { vendor_id: vendorId },
                    required: true,
                },
            ],
            order: [["start_date", "ASC"]],
        });

        // Debug: Check what batches we're getting for 30 days
        // console.log(`🔍 DEBUG 30 Days - Total Earnings`);
        // console.log(`📅 Date Range: ${startDateStr} to ${endDateStr}`);
        // console.log(`📊 Found ${batches30Days.length} batches`);
        // if (batches30Days.length > 0) {
        //     console.log(`📅 Batch dates:`, batches30Days.map(b => ({
        //         id: b.id,
        //         start_date: b.start_date,
        //         trek_title: b.trek?.title
        //     })));
        // }

        let totalEarningsAmount = 0;
        let totalEarningsCount = 0;

        for (const batch of batches30Days) {
            const bookings = await Booking.findAll({
                where: {
                    batch_id: batch.id,
                    vendor_id: vendorId,
                    status: { [Op.in]: ["confirmed", "completed", "cancelled"] },
                },
                include: [
                    { model: Trek, as: "trek", attributes: ["title", "base_price"] },
                ],
            });

            for (const booking of bookings) {
                const trekBasePrice = parseFloat(booking.trek?.base_price || 0);
                const vendorDiscount = parseFloat(booking.vendor_discount || 0);
                const couponDiscount = parseFloat(booking.coupon_discount || 0);

                let refundableAmount = 0;
                if (booking.status === "cancelled") {
                    const cancellationData = await CancellationBooking.findOne({
                        where: { 
                            booking_id: booking.id, 
                            trek_id: booking.trek_id, 
                            batch_id: booking.batch_id 
                        },
                        attributes: ["total_refundable_amount"],
                    });
                    refundableAmount = parseFloat(cancellationData?.total_refundable_amount || 0);
                }

                const earningsAmount = trekBasePrice - vendorDiscount - couponDiscount - refundableAmount;
                totalEarningsAmount += earningsAmount;
                totalEarningsCount++;
            }
        }

        // 2. TOTAL REFUNDS - Filter by issue_reports created_at for last 30 days
        // Only include refunds where favour_status is 'Adjustment' or 'Customer Favour'
        const issueReports30Days = await IssueReport.findAll({
            where: {
                disputed_amount: { [Op.gt]: 0 },
                created_at: { [Op.between]: [startDateStr, endDateStr] },
                favoue_status: { [Op.in]: ['Adjustment', 'Customer Favour'] }
            },
            include: [
                {
                    model: Booking,
                    as: "booking",
                    attributes: ["vendor_id"],
                    where: { vendor_id: vendorId },
                    required: true,
                },
            ],
        });

        let totalRefundsAmount = 0;
        for (const issueReport of issueReports30Days) {
            const favourAmount = parseFloat(issueReport.favour_amount || 0);
            totalRefundsAmount += Number.isFinite(favourAmount) && favourAmount > 0
                ? favourAmount
                : parseFloat(issueReport.disputed_amount || 0);
        }

        // 3. CANCELLATIONS - Filter by cancellation_bookings cancellation_date for last 30 days
        const cancellations30Days = await CancellationBooking.findAll({
            where: {
                cancellation_date: { [Op.between]: [startDateStr, endDateStr] }
            },
            include: [
                {
                    model: Booking,
                    as: "booking",
                    attributes: ["vendor_id"],
                    where: { vendor_id: vendorId },
                    required: true,
                },
            ],
        });

        res.json({
            success: true,
            data: {
                period: "30days",
                dateRange: { startDate: startDateStr, endDate: endDateStr },
                totalEarnings: {
                    amount: totalEarningsAmount,
                    count: totalEarningsCount,
                    description: `Total earnings from batches with start_date between ${startDateStr} and ${endDateStr}`
                },
                totalRefunds: {
                    amount: totalRefundsAmount,
                    count: issueReports30Days.length,
                    description: `Total refunds (favour_amount) from issue_reports (favour_status: Adjustment or Customer Favour) created between ${startDateStr} and ${endDateStr}`
                },
                cancellations: {
                    count: cancellations30Days.length,
                    description: `Total cancelled bookings with cancellation_date between ${startDateStr} and ${endDateStr}`
                },
                calculatedAt: currentDate.toISOString(),
            }
        });
    } catch (error) {
        logger.error("wallet", "Error getting 30 days analytics", { vendorId: req.user?.id, error: error.message });
        res.status(500).json({ success: false, message: "Failed to get 30 days analytics", error: error.message });
    }
};

/**
 * Get analytics insights for yearly
 * @route   GET /api/vendor/wallet/analytics-yearly
 * @desc    Get Total Earnings, Total Refunds, and Cancellations for last 1 year
 * @access  Private (Vendor)
 */
const getAnalyticsYearly = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const currentDate = new Date();
        const startDate = new Date(currentDate);
        startDate.setFullYear(currentDate.getFullYear() - 1);
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = currentDate.toISOString().split('T')[0];

        logger.info("wallet", "Getting yearly analytics", { vendorId, startDateStr, endDateStr });

        // 1. TOTAL EARNINGS - Filter by batch start_date for last 1 year
        const batchesYearly = await Batch.findAll({
            where: { 
                start_date: { 
                    [Op.between]: [startDateStr, endDateStr] 
                } 
            },
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "vendor_id"],
                    where: { vendor_id: vendorId },
                    required: true,
                },
            ],
            order: [["start_date", "ASC"]],
        });

        // Debug: Check what batches we're getting for yearly
        // console.log(`🔍 DEBUG Yearly - Total Earnings`);
        // console.log(`📅 Date Range: ${startDateStr} to ${endDateStr}`);
        // console.log(`📊 Found ${batchesYearly.length} batches`);
        // if (batchesYearly.length > 0) {
        //     console.log(`📅 Batch dates:`, batchesYearly.map(b => ({
        //         id: b.id,
        //         start_date: b.start_date,
        //         trek_title: b.trek?.title
        //     })));
        // }

        let totalEarningsAmount = 0;
        let totalEarningsCount = 0;

        for (const batch of batchesYearly) {
            const bookings = await Booking.findAll({
                where: {
                    batch_id: batch.id,
                    vendor_id: vendorId,
                    status: { [Op.in]: ["confirmed", "completed", "cancelled"] },
                },
                include: [
                    { model: Trek, as: "trek", attributes: ["title", "base_price"] },
                ],
            });

            for (const booking of bookings) {
                const trekBasePrice = parseFloat(booking.trek?.base_price || 0);
                const vendorDiscount = parseFloat(booking.vendor_discount || 0);
                const couponDiscount = parseFloat(booking.coupon_discount || 0);

                let refundableAmount = 0;
                if (booking.status === "cancelled") {
                    const cancellationData = await CancellationBooking.findOne({
                        where: { 
                            booking_id: booking.id, 
                            trek_id: booking.trek_id, 
                            batch_id: booking.batch_id 
                        },
                        attributes: ["total_refundable_amount"],
                    });
                    refundableAmount = parseFloat(cancellationData?.total_refundable_amount || 0);
                }

                const earningsAmount = trekBasePrice - vendorDiscount - couponDiscount - refundableAmount;
                totalEarningsAmount += earningsAmount;
                totalEarningsCount++;
            }
        }

        // 2. TOTAL REFUNDS - Filter by issue_reports created_at for last 1 year
        // Only include refunds where favour_status is 'Adjustment' or 'Customer Favour'
        const issueReportsYearly = await IssueReport.findAll({
            where: {
                disputed_amount: { [Op.gt]: 0 },
                created_at: { [Op.between]: [startDateStr, endDateStr] },
                favoue_status: { [Op.in]: ['Adjustment', 'Customer Favour'] }
            },
            include: [
                {
                    model: Booking,
                    as: "booking",
                    attributes: ["vendor_id"],
                    where: { vendor_id: vendorId },
                    required: true,
                },
            ],
        });

        let totalRefundsAmount = 0;
        for (const issueReport of issueReportsYearly) {
            const favourAmount = parseFloat(issueReport.favour_amount || 0);
            totalRefundsAmount += Number.isFinite(favourAmount) && favourAmount > 0
                ? favourAmount
                : parseFloat(issueReport.disputed_amount || 0);
        }

        // 3. CANCELLATIONS - Filter by cancellation_bookings cancellation_date for last 1 year
        const cancellationsYearly = await CancellationBooking.findAll({
            where: {
                cancellation_date: { [Op.between]: [startDateStr, endDateStr] }
            },
            include: [
                {
                    model: Booking,
                    as: "booking",
                    attributes: ["vendor_id"],
                    where: { vendor_id: vendorId },
                    required: true,
                },
            ],
        });

        res.json({
            success: true,
            data: {
                period: "yearly",
                dateRange: { startDate: startDateStr, endDate: endDateStr },
                totalEarnings: {
                    amount: totalEarningsAmount,
                    count: totalEarningsCount,
                    description: `Total earnings from batches with start_date between ${startDateStr} and ${endDateStr}`
                },
                totalRefunds: {
                    amount: totalRefundsAmount,
                    count: issueReportsYearly.length,
                    description: `Total refunds (favour_amount) from issue_reports (favour_status: Adjustment or Customer Favour) created between ${startDateStr} and ${endDateStr}`
                },
                cancellations: {
                    count: cancellationsYearly.length,
                    description: `Total cancelled bookings with cancellation_date between ${startDateStr} and ${endDateStr}`
                },
                calculatedAt: currentDate.toISOString(),
            }
        });
    } catch (error) {
        logger.error("wallet", "Error getting yearly analytics", { vendorId: req.user?.id, error: error.message });
        res.status(500).json({ success: false, message: "Failed to get yearly analytics", error: error.message });
    }
};

/**
 * Get detailed TBR-wise breakdown with batch information
 */
exports.getTbrBreakdownDetailed = async (req, res) => {
    try {
        const vendorId = req.user.id;
        
        // Get pagination parameters from query
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        logger.info("wallet", "Fetching detailed TBR breakdown", { vendorId, page, limit, offset });

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Get vendor details
        const vendor = await Vendor.findByPk(vendorId);
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor not found",
            });
        }

        // Get all batches for this vendor with related data (without pagination first)
        const allBatches = await Batch.findAll({
            include: [
                {
                    model: Trek,
                    as: 'trek',
                    where: {
                        vendor_id: vendorId
                    },
                    attributes: ['id', 'title', 'base_price', 'cancellation_policy_id'],
                    include: [
                        {
                            model: require('../../models').CancellationPolicy,
                            as: 'cancellation_policy',
                            attributes: ['id', 'title', 'description']
                        }
                    ]
                },
                {
                    model: Booking,
                    as: 'bookings',
                    attributes: [
                        'id',
                        'customer_id',
                        'total_amount',
                        'final_amount',
                        'payment_status',
                        'status',
                        'vendor_discount',
                        'coupon_discount',
                        'total_travelers'
                    ],
                    include: [
                        {
                            model: Customer,
                            as: 'customer',
                            attributes: ['id', 'name', 'email', 'phone']
                        }
                    ]
                }
            ],
            order: [['start_date', 'DESC']]
        });

        // Filter batches that have bookings
        const batchesWithBookings = allBatches.filter(batch => {
            const batchBookings = batch.bookings || [];
            return batchBookings.length > 0;
        });

        // Get total count of batches with bookings
        const totalBatchesCount = batchesWithBookings.length;
        console.log(`=== BATCH COUNT DEBUG ===`);
        console.log(`Total batches found for vendor: ${allBatches.length}`);
        console.log(`Batches with bookings: ${totalBatchesCount}`);
        console.log(`Batches without bookings: ${allBatches.length - totalBatchesCount}`);
        
        // Log some batch details for debugging
        allBatches.slice(0, 5).forEach((batch, index) => {
            console.log(`Batch ${index + 1}: ID=${batch.id}, TBR=${batch.tbr_id}, Bookings=${batch.bookings?.length || 0}`);
        });

        // Apply pagination to filtered batches
        const batches = batchesWithBookings.slice(offset, offset + limit);

        // Get cancellation data for all batches with bookings (not just current page)
        const allBatchIds = batchesWithBookings.map(batch => batch.id);
        console.log(`Looking for cancellations for all batch IDs: ${allBatchIds.join(', ')}`);
        
        const cancellations = await CancellationBooking.findAll({
            where: {
                batch_id: {
                    [Op.in]: allBatchIds
                }
            },
            include: [
                {
                    model: Booking,
                    as: 'booking',
                    attributes: ['id', 'total_amount', 'final_amount']
                }
            ]
        });

        console.log(`Found ${cancellations.length} cancellations total`);
        cancellations.forEach(cancellation => {
            console.log(`Cancellation ${cancellation.id}: batch_id=${cancellation.batch_id}, refund_amount=${cancellation.total_refundable_amount}`);
        });

        // Group cancellations by batch_id
        const cancellationsByBatch = {};
        cancellations.forEach(cancellation => {
            if (!cancellationsByBatch[cancellation.batch_id]) {
                cancellationsByBatch[cancellation.batch_id] = [];
            }
            cancellationsByBatch[cancellation.batch_id].push(cancellation);
        });

        // Calculate detailed breakdown for each batch
        const tbrBreakdown = await Promise.all(batches.map(async (batch) => {
            const batchBookings = batch.bookings || [];
            const bookingMap = new Map();
            batchBookings.forEach(booking => bookingMap.set(booking.id, booking));

            // Separate cancelled bookings for dedicated reporting
            const cancelledBatchBookings = batchBookings.filter(booking => booking.status === 'cancelled');

            // Exclude cancelled bookings from main calculations and display
            const activeBatchBookings = batchBookings.filter(booking => booking.status !== 'cancelled');
            const batchCancellations = cancellationsByBatch[batch.id] || [];
            
            // Note: We'll calculate totals after filtering bookings with "Customer Favour" status
            // These initial totals are placeholders, will be recalculated after filtering
            const totalBookingAmount = activeBatchBookings.reduce((sum, booking) => {
                return sum + parseFloat(booking.total_amount || 0);
            }, 0);
            
            const totalFinalAmount = activeBatchBookings.reduce((sum, booking) => {
                return sum + parseFloat(booking.final_amount || 0);
            }, 0);

            // Calculate cancellation amounts
            const totalCancellationAmount = batchCancellations.reduce((sum, cancellation) => {
                return sum + parseFloat(cancellation.total_refundable_amount || 0);
            }, 0);

            // Debug logging for cancellation amounts
            if (batchCancellations.length > 0) {
                console.log(`Batch ${batch.id} has ${batchCancellations.length} cancellations:`);
                batchCancellations.forEach(cancellation => {
                    console.log(`  Cancellation ${cancellation.id}: refund_amount = ${cancellation.total_refundable_amount}`);
                });
                console.log(`  Total cancellation amount: ${totalCancellationAmount}`);
            }

            // Get dispute reports first to filter out bookings with "Customer Favour" status
            const batchBookingIds = activeBatchBookings.map(booking => booking.id);
            const disputeReports = await IssueReport.findAll({
                where: {
                    booking_id: {
                        [Op.in]: batchBookingIds
                    }
                },
                attributes: ['booking_id', 'favoue_status']
            });

            // Find booking IDs that have "Customer Favour" status - these should be excluded
            const customerFavourBookingIds = new Set(
                disputeReports
                    .filter(report => report.favoue_status === 'Customer Favour')
                    .map(report => report.booking_id)
            );

            // Filter out bookings with "Customer Favour" status
            const filteredBatchBookings = activeBatchBookings.filter(booking => 
                !customerFavourBookingIds.has(booking.id)
            );

            // Recalculate totals after filtering
            const filteredTotalBookingAmount = filteredBatchBookings.reduce((sum, booking) => {
                return sum + parseFloat(booking.total_amount || 0);
            }, 0);
            
            const filteredTotalFinalAmount = filteredBatchBookings.reduce((sum, booking) => {
                return sum + parseFloat(booking.final_amount || 0);
            }, 0);

            // Recalculate platform commission based on filtered bookings
            const filteredPlatformCommission = filteredTotalBookingAmount * 0.10;

            // Get booking details with payment status and calculated payable/net amounts
            let totalTcsAmountForBatch = 0;

            const bookingDetails = filteredBatchBookings.map((booking) => {
                const basePrice = parseFloat(batch.trek?.base_price || 0);
                const vendorDiscount = parseFloat(booking.vendor_discount || 0);
                const couponDiscount = parseFloat(booking.coupon_discount || 0);
                const travellerCountRaw =
                    booking.total_travelers ?? booking.total_travellers ?? 0;
                const totalTravellers = Number.isNaN(parseInt(travellerCountRaw, 10))
                    ? 0
                    : parseInt(travellerCountRaw, 10);

                const paymentStatus = booking.payment_status || 'pending';
                const newBasePrice = Math.max(
                    basePrice - vendorDiscount - couponDiscount,
                    0,
                );

                const isFullPayment = ['full_paid', 'completed', 'full'].includes(
                    paymentStatus,
                );

                // Step 1: Calculate bookings payable amount
                // If full_paid: new_base_price * total_travelers
                // If partial: 999 * total_travelers
                const fullBookingPayableAmount = totalTravellers * newBasePrice;
                const partialPayableAmount = totalTravellers * 999;
                
                const bookingPayableAmount = isFullPayment
                    ? fullBookingPayableAmount
                    : partialPayableAmount;
                
                const collectedAmount = isFullPayment
                    ? fullBookingPayableAmount
                    : partialPayableAmount;

                // Step 2: Calculate commission and tax based on new_base_price (always, regardless of payment status)
                const commissionPerTraveller = newBasePrice * 0.1; // 10% commission
                const taxPerTraveller = commissionPerTraveller * 0.18; // 18% tax on commission
                
                // Multiply by total travelers
                const totalCommissionAmount = commissionPerTraveller * totalTravellers;
                const totalTaxAmount = taxPerTraveller * totalTravellers;
                const platformCommissionAmount = totalCommissionAmount + totalTaxAmount;

                // Step 3: Calculate TCS amount
                const tcsPerTraveller = newBasePrice * 0.01; // 1% TCS
                const totalTcsAmount = tcsPerTraveller * totalTravellers;

                totalTcsAmountForBatch += totalTcsAmount;

                // Step 4: Calculate net amount
                // net_amount = bookings_payable_amount - platform_commission_amount - tcs_amount
                const calculatedNetAmount = bookingPayableAmount - platformCommissionAmount - totalTcsAmount;

                return {
                    booking_id: booking.id,
                    customer_id: booking.customer_id,
                    customer_name: booking.customer?.name || 'Unknown',
                    customer_email: booking.customer?.email || '',
                    customer_phone: booking.customer?.phone || '',
                    total_amount: parseFloat(booking.total_amount || 0),
                    final_amount: parseFloat(booking.final_amount || 0),
                    payment_status: paymentStatus,
                    total_travelers: totalTravellers,
                    vendor_discount: vendorDiscount,
                    coupon_discount: couponDiscount,
                    calculation: {
                        base_price: basePrice,
                        vendor_discount: vendorDiscount,
                        coupon_discount: couponDiscount,
                        new_base_price: newBasePrice,
                        total_travelers: totalTravellers,
                        payable_amount: bookingPayableAmount,
                        collected_amount: collectedAmount,
                        partial_payable_amount: partialPayableAmount,
                        commission_per_traveler: commissionPerTraveller,
                        tax_per_traveler: taxPerTraveller,
                        tcs_per_traveler: tcsPerTraveller,
                        total_commission_amount: totalCommissionAmount,
                        total_tax_amount: totalTaxAmount,
                        platform_commission_amount: platformCommissionAmount,
                        total_tcs_amount: totalTcsAmount,
                        net_amount: calculatedNetAmount,
                    },
                };
            });

            // Filter cancellations to exclude those related to bookings with "Customer Favour" status
            const filteredBatchCancellations = batchCancellations.filter(cancellation => 
                !customerFavourBookingIds.has(cancellation.booking_id)
            );

            // Recalculate cancellation amounts after filtering
            const filteredTotalCancellationAmount = filteredBatchCancellations.reduce((sum, cancellation) => {
                return sum + parseFloat(cancellation.total_refundable_amount || 0);
            }, 0);

            // Get cancellation details
            const cancellationDetails = filteredBatchCancellations.map(cancellation => ({
                cancellation_id: cancellation.id,
                booking_id: cancellation.booking_id,
                customer_id: cancellation.customer_id,
                refund_amount: parseFloat(cancellation.total_refundable_amount || 0),
                payback_amount: parseFloat(cancellation.deduction_vendor || 0),
                status: cancellation.status,
                cancellation_date: cancellation.cancellation_date,
                reason: cancellation.reason
            }));

            // Calculate separate amounts for disputes and paybacks (using filtered cancellations)
            const totalPaybackAmount = filteredBatchCancellations.reduce((sum, cancellation) => {
                return sum + parseFloat(cancellation.deduction_vendor || 0);
            }, 0);

            // Calculate dispute amount for this batch from issues_reports table
            // Use filtered booking IDs (excluding Customer Favour)
            const filteredBatchBookingIds = filteredBatchBookings.map(booking => booking.id);
            const disputeReportsForCalculation = await IssueReport.findAll({
                where: {
                    booking_id: {
                        [Op.in]: filteredBatchBookingIds
                    }
                },
                attributes: ['booking_id', 'disputed_amount', 'favour_amount', 'status', 'favoue_status']
            });

            // Create Adjustment object - collect all records with favour_status = "Adjustment"
            const adjustmentReports = disputeReportsForCalculation.filter(report => 
                report.favoue_status === 'Adjustment'
            );

            const adjustmentData = adjustmentReports.map(report => ({
                booking_id: report.booking_id,
                disputed_amount: parseFloat(report.disputed_amount || 0),
                favour_amount: parseFloat(report.favour_amount || 0)
            }));

            // Calculate totals for Adjustment data
            const total_of_disputed_amount = adjustmentData.reduce((sum, item) => 
                sum + item.disputed_amount, 0
            );
            const total_of_favour_amount = adjustmentData.reduce((sum, item) => 
                sum + item.favour_amount, 0
            );

            // Calculate second_payback_amount
            const second_payback_amount = total_of_disputed_amount - total_of_favour_amount;

            // Check condition: If both total_payback_amount and second_payback_amount are 0, return 0 directly
            let final_paybacked_amount = 0;
            let first_paybacked_amount = 0;
            let second_paybacked_amount = 0;

            if (totalPaybackAmount === 0 && second_payback_amount === 0) {
                // Both are 0, so final_paybacked_amount should be 0
                final_paybacked_amount = 0;
            } else {
                // Step 1: Payback amount directly contributes to first_paybacked_amount
                first_paybacked_amount = totalPaybackAmount;

                // Step 2: Calculate second_paybacked_amount from second_payback_amount
                if (second_payback_amount > 0) {
                    const first_disputed_amount = second_payback_amount * 0.10; // second_payback_amount * 10%
                    const second_disputed_amount = second_payback_amount * 0.05; // second_payback_amount * 5%
                    const third_disputed_amount = second_payback_amount * 0.01; // second_payback_amount * 1%
                    const fourth_disputed_amount = first_disputed_amount * 0.18; // first_disputed_amount * 18%
                    second_paybacked_amount = second_payback_amount - first_disputed_amount - second_disputed_amount - fourth_disputed_amount;
                }

                // Final: Calculate final_paybacked_amount
                final_paybacked_amount = first_paybacked_amount + second_paybacked_amount;
            }
            
            // Group dispute amounts by status
            const disputesByStatus = {
                in_progress: 0,    // Yellow
                resolved: 0,       // Red (refunded)
                closed: 0,         // Green (released)
                other: 0,          // Default
                no_action: 0       // No Action (based on favour_status)
            };
            
            disputeReportsForCalculation.forEach(report => {
                const amount = parseFloat(report.disputed_amount || 0);
                const status = report.status;
                const favourStatus = report.favoue_status;
                
                // Check for "No Action" favour status first
                if (favourStatus === 'No Action') {
                    disputesByStatus.no_action += amount;
                } else if (status === 'in_progress') {
                    disputesByStatus.in_progress += amount;
                } else if (status === 'resolved') {
                    disputesByStatus.resolved += amount;
                } else if (status === 'closed') {
                    disputesByStatus.closed += amount;
                } else {
                    disputesByStatus.other += amount;
                }
            });
            
            // Calculate total dispute amount (for "No Action" only, as per requirement)
            const totalDisputeAmount = disputesByStatus.no_action;
            

            const netAmount =
                filteredTotalBookingAmount -
                filteredTotalCancellationAmount -
                filteredPlatformCommission -
                totalTcsAmountForBatch +
                totalPaybackAmount -
                disputesByStatus.in_progress -
                disputesByStatus.resolved +
                disputesByStatus.closed -
                disputesByStatus.other;

            const cancelledBookingDetails = cancelledBatchBookings.map(booking => ({
                booking_id: booking.id,
                total_amount: parseFloat(booking.total_amount || 0),
                final_amount: parseFloat(booking.final_amount || 0),
                payment_status: booking.payment_status,
                total_travelers: booking.total_travelers || 0,
            }));


            return {
                batch_id: batch.id,
                tbr_id: batch.tbr_id,
                trek_id: batch.trek_id,
                trek_name: batch.trek?.title || 'Unknown Trek',
                base_price: parseFloat(batch.trek?.base_price || 0),
                start_date: batch.start_date,
                end_date: batch.end_date,
                capacity: batch.capacity,
                booked_slots: batch.booked_slots,
                
                // Cancellation Policy Information
                cancellation_policy_id: batch.trek?.cancellation_policy_id || null,
                cancellation_policy_name: batch.trek?.cancellation_policy?.title || 'Standard Policy',
                cancellation_policy_type: batch.trek?.cancellation_policy?.title ? 
                    (batch.trek.cancellation_policy.title.toLowerCase().includes('flexible') ? 'flexible' : 'standard') : 'standard',
                
                // Booking information (using filtered bookings)
                total_bookings: filteredBatchBookings.length,
                total_booking_amount: filteredTotalBookingAmount,
                total_final_amount: filteredTotalFinalAmount,
                bookings: bookingDetails,
                
                // Cancellation information (using filtered cancellations)
                total_cancellations: filteredBatchCancellations.length,
                total_cancellation_amount: filteredTotalCancellationAmount,
                total_dispute_amount: totalDisputeAmount,
                disputes_by_status: disputesByStatus,
                total_payback_amount: totalPaybackAmount,
                total_tcs_amount: totalTcsAmountForBatch,
                cancellations: cancellationDetails,
                cancelled_bookings: cancelledBookingDetails,
                
                // Adjustment data object
                adjustment_data: {
                    records: adjustmentData,
                    total_of_disputed_amount: total_of_disputed_amount,
                    total_of_favour_amount: total_of_favour_amount,
                    second_payback_amount: second_payback_amount,
                    second_paybacked_amount: second_paybacked_amount,
                    first_paybacked_amount: first_paybacked_amount,
                    final_paybacked_amount: final_paybacked_amount
                },
                
                // Financial calculations (using filtered values)
                platform_commission: filteredPlatformCommission,
                net_amount: netAmount,
                
                // Summary (using filtered values)
                summary: {
                    gross_amount: filteredTotalBookingAmount,
                    refunds_deducted: filteredTotalCancellationAmount,
                    tcs_amount: totalTcsAmountForBatch,
                    disputes_amount: totalDisputeAmount,
                    paybacks_amount: totalPaybackAmount,
                    commissions_deducted: filteredPlatformCommission,
                    net_amount: netAmount
                }
            };
        }));

        // Calculate pagination metadata
        const amountFields = [
            "base_price",
            "new_base_price",
            "total_booking_amount",
            "total_final_amount",
            "total_cancellation_amount",
            "total_dispute_amount",
            "total_payback_amount",
            "platform_commission",
            "net_amount",
            "gross_amount",
            "refunds_deducted",
            "disputes_amount",
            "paybacks_amount",
            "commissions_deducted",
            "total_amount",
            "final_amount",
            "refund_amount",
            "payback_amount",
            "vendor_discount",
            "coupon_discount",
            "payable_amount",
            "commission_per_traveler",
            "tax_per_traveler",
            "total_commission_amount",
            "total_tax_amount",
            "platform_commission_amount",
            "tcs_per_traveler",
            "total_tcs_amount",
            "collected_amount",
            "partial_payable_amount"
        ];

        const roundedBreakdown = roundAmountsInObject(tbrBreakdown, amountFields);

        const totalPages = Math.ceil(totalBatchesCount / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        logger.info("wallet", "TBR breakdown calculated", { 
            vendorId, 
            allBatches: allBatches.length,
            batchesWithBookings: totalBatchesCount,
            returnedBatches: roundedBreakdown.length,
            currentPage: page,
            totalPages: totalPages
        });

        return res.json({
            success: true,
            message: "TBR breakdown retrieved successfully",
            data: {
                vendor_id: vendorId,
                vendor_name: vendor.name,
                tbr_breakdown: roundedBreakdown,
                // Batch count information
                batch_counts: {
                    total_batches: totalBatchesCount,           // Total batches with bookings
                    current_page_batches: roundedBreakdown.length,  // Batches returned in current response
                    batches_per_page: limit
                },
                pagination: {
                    current_page: page,
                    total_pages: totalPages,
                    total_batches: totalBatchesCount,
                    batches_per_page: limit,
                    has_next_page: hasNextPage,
                    has_prev_page: hasPrevPage
                },
                summary: {
                    total_base_price: roundAmount(roundedBreakdown.reduce((sum, tbr) => sum + (tbr.base_price || 0), 0)),
                    total_booking_amount: roundAmount(roundedBreakdown.reduce((sum, tbr) => sum + (tbr.total_booking_amount || 0), 0)),
                    total_cancellation_amount: roundAmount(roundedBreakdown.reduce((sum, tbr) => sum + (tbr.total_cancellation_amount || 0), 0)),
                    total_platform_commission: roundAmount(roundedBreakdown.reduce((sum, tbr) => sum + (tbr.platform_commission || 0), 0)),
                    total_net_amount: roundAmount(roundedBreakdown.reduce((sum, tbr) => sum + (tbr.net_amount || 0), 0))
                }
            }
        });

    } catch (error) {
        logger.error("wallet", "Error fetching detailed TBR breakdown", {
            error: error.message,
            stack: error.stack,
            vendorId: req.user?.id
        });

        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching TBR breakdown",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Create a new withdrawal request
 */
exports.createWithdrawalRequest = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const { amount } = req.body;
        
        logger.info("wallet", "Creating withdrawal request", { vendorId, amount });

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid withdrawal amount.",
            });
        }

        // Get vendor details
        const vendor = await Vendor.findByPk(vendorId);
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor not found",
            });
        }

        // Get batches with bookings for this vendor (needed for both balance calculation and TBR count)
        const batches = await Batch.findAll({
            include: [
                {
                    model: Trek,
                    as: 'trek',
                    where: {
                        vendor_id: vendorId
                    },
                    attributes: []
                },
                {
                    model: Booking,
                    as: 'bookings',
                    attributes: ['id', 'total_amount', 'final_amount'],
                    required: true
                }
            ]
        });

        // Calculate current available balance from TBR breakdown
        let availableBalance = 0;
        
        // Calculate net amount from all batches
        for (const batch of batches) {
            const totalBookingAmount = batch.bookings.reduce((sum, booking) => {
                return sum + parseFloat(booking.total_amount || 0);
            }, 0);
            
            const platformCommission = totalBookingAmount * 0.10;
            const netAmount = totalBookingAmount - platformCommission;
            availableBalance += netAmount;
        }
        
        console.log(`Calculated available balance: ₹${availableBalance}`);

        // Check if withdrawal amount is valid
        if (amount > availableBalance) {
            return res.status(400).json({
                success: false,
                message: `Insufficient balance. Available balance: ₹${availableBalance.toLocaleString("en-IN")}`,
            });
        }

        // Get TBR count from the batches we fetched
        const tbrsCount = batches.length;

        // Create withdrawal request
        const withdrawal = await Withdrawal.create({
            vendor_id: vendorId,
            amount: parseFloat(amount),
            tbrs_count: tbrsCount,
            status: 'pending'
        });

        logger.info("wallet", "Withdrawal request created", { 
            vendorId, 
            withdrawalId: withdrawal.withdrawal_id,
            amount: withdrawal.amount,
            tbrsCount: withdrawal.tbrs_count
        });

        return res.json({
            success: true,
            message: "Withdrawal request created successfully",
            data: {
                withdrawal_id: withdrawal.withdrawal_id,
                amount: withdrawal.amount,
                tbrs_count: withdrawal.tbrs_count,
                status: withdrawal.status,
                notes: withdrawal.notes,
                withdrawal_date: withdrawal.withdrawal_date
            }
        });

    } catch (error) {
        logger.error("wallet", "Error creating withdrawal request", {
            error: error.message,
            stack: error.stack,
            vendorId: req.user?.id
        });

        return res.status(500).json({
            success: false,
            message: "Internal server error while creating withdrawal request",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get withdrawal history using new withdrawal table
 */
exports.getWithdrawalHistoryNew = async (req, res) => {
    try {
        const vendorId = req.user.id;
        
        // Get pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        logger.info("wallet", "Fetching withdrawal history", { vendorId, page, limit });

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Get total count of withdrawals
        const totalCount = await Withdrawal.count({
            where: {
                vendor_id: vendorId
            }
        });

        // Get paginated withdrawal history
        const withdrawals = await Withdrawal.findAll({
            where: {
                vendor_id: vendorId
            },
            order: [['withdrawal_date', 'DESC']],
            limit: limit,
            offset: offset
        });

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalCount / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        logger.info("wallet", "Withdrawal history retrieved", { 
            vendorId, 
            totalWithdrawals: totalCount,
            currentPage: page,
            totalPages: totalPages,
            withdrawalsInPage: withdrawals.length
        });

        return res.json({
            success: true,
            message: "Withdrawal history retrieved successfully",
            data: {
                withdrawals: withdrawals.map(withdrawal => ({
                    id: withdrawal.id,
                    withdrawal_id: withdrawal.withdrawal_id,
                    amount: roundAmount(parseFloat(withdrawal.amount || 0)),
                    tbrs_count: withdrawal.tbrs_count,
                    status: withdrawal.status,
                    notes: withdrawal.notes,
                    rejected_reason: withdrawal.rejected_reason,
                    withdrawal_date: withdrawal.withdrawal_date,
                    status_change_date: withdrawal.status_change_date
                }))
            },
            pagination: {
                current_page: page,
                total_pages: totalPages,
                total_records: totalCount,
                records_per_page: limit,
                has_next_page: hasNextPage,
                has_prev_page: hasPrevPage
            }
        });

    } catch (error) {
        logger.error("wallet", "Error fetching withdrawal history", {
            error: error.message,
            stack: error.stack,
            vendorId: req.user?.id
        });

        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching withdrawal history",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Calculate wallet balances directly from bookings and batches
 */
async function calculateBalancesDirectly(vendorId) {
    try {
        // Get all batches for the vendor with bookings
        const batches = await Batch.findAll({
            include: [
                {
                    model: Trek,
                    as: 'trek',
                    where: { vendor_id: vendorId },
                    attributes: []
                },
                {
                    model: Booking,
                    as: 'bookings',
                    attributes: ['id', 'total_amount', 'final_amount', 'status'],
                    required: false
                }
            ]
        });

        let totalEarnings = 0;
        let availableBalance = 0;
        let lockedBalance = 0;

        const today = new Date();
        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(today.getDate() - 3);
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(today.getDate() - 2);

        for (const batch of batches) {
            const batchStartDate = new Date(batch.start_date);
            
            // Calculate total booking amount for this batch
            const totalBookingAmount = batch.bookings.reduce((sum, booking) => {
                if (booking.status === 'confirmed' || booking.status === 'completed') {
                    return sum + parseFloat(booking.total_amount || 0);
                }
                return sum;
            }, 0);
            
            const platformCommission = totalBookingAmount * 0.10; // 10% commission
            const netAmount = totalBookingAmount - platformCommission;
            
            totalEarnings += netAmount;
            
            // Determine if amount is available or locked
            if (batchStartDate <= threeDaysAgo) {
                // Available for withdrawal (batch started more than 3 days ago)
                availableBalance += netAmount;
            } else if (batchStartDate <= twoDaysAgo) {
                // Locked (batch started within 2-3 days)
                lockedBalance += netAmount;
            } else {
                // Future batch, not yet available
                lockedBalance += netAmount;
            }
        }

        return {
            availableBalance: roundAmount(availableBalance),
            lockedBalance: roundAmount(lockedBalance),
            totalEarnings: roundAmount(totalEarnings),
            totalBalance: roundAmount(availableBalance + lockedBalance)
        };

    } catch (error) {
        logger.error("wallet", "Error calculating balances directly", {
            error: error.message,
            vendorId
        });
        
        return {
            availableBalance: 0,
            lockedBalance: 0,
            totalEarnings: 0,
            totalBalance: 0
        };
    }
}

// New Total Earnings APIs
const getTotalEarnings7Days = async (req, res) => {
    try {
        const vendorId = req.user.id;
        
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const endDateStr = `${year}-${month}-${day}`;
        
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - 6); // 6 days before current date
        
        const startYear = startDate.getFullYear();
        const startMonth = String(startDate.getMonth() + 1).padStart(2, '0');
        const startDay = String(startDate.getDate()).padStart(2, '0');
        const startDateStr = `${startYear}-${startMonth}-${startDay}`;

        console.log(`🔍 7 DAYS TOTAL EARNINGS API - Date Range: ${startDateStr} to ${endDateStr}`);
        logger.info("wallet", "Getting 7 days total earnings", { vendorId, startDateStr, endDateStr });

        const batches = await Batch.findAll({
            where: {
                start_date: {
                    [Op.between]: [startDateStr, endDateStr]
                }
            },
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "vendor_id"],
                    where: { vendor_id: vendorId },
                    required: true,
                }
            ],
            order: [["start_date", "ASC"]]
        });

        console.log(`📊 7 DAYS TOTAL EARNINGS API - Found ${batches.length} batches`);

        let totalEarningsAmount = 0;
        let totalEarningsCount = 0;
        let totalTravelersOverall = 0;

        for (const batch of batches) {
            const bookings = await Booking.findAll({
                where: {
                    batch_id: batch.id,
                    vendor_id: vendorId,
                    status: {
                        [Op.in]: ["confirmed", "completed", "cancelled"]
                    }
                },
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        attributes: ["title", "base_price"]
                    }
                ]
            });

            if (bookings.length === 0) {
                continue;
            }

            for (const booking of bookings) {
                const trekBasePrice = parseFloat(booking.trek?.base_price || 0);
                const vendorDiscount = parseFloat(booking.vendor_discount || 0);
                const couponDiscount = parseFloat(booking.coupon_discount || 0);
                
                let earningsAmountPerPerson = trekBasePrice - vendorDiscount - couponDiscount;
                const totalTravelers = booking.total_travelers || 1;
                let earningsAmount = earningsAmountPerPerson * totalTravelers;

                let refundableAmount = 0;

                if (booking.status === "cancelled") {
                    const cancellationData = await CancellationBooking.findOne({
                        where: {
                            booking_id: booking.id,
                            trek_id: booking.trek_id,
                            batch_id: booking.batch_id
                        },
                        attributes: ["total_refundable_amount"]
                    });

                    if (cancellationData) {
                        refundableAmount = parseFloat(cancellationData.total_refundable_amount || 0) * totalTravelers;
                        earningsAmount -= refundableAmount;
                    }
                }

                totalEarningsAmount += earningsAmount;
                totalEarningsCount++;
                totalTravelersOverall += totalTravelers;
            }
        }

        console.log(`💰 7 DAYS TOTAL EARNINGS API - Total Earnings: ${totalEarningsAmount}, Count: ${totalEarningsCount}, Travelers: ${totalTravelersOverall}`);

        const roundedTotalEarnings = roundAmount(totalEarningsAmount);

        res.json({
            success: true,
            data: {
                period: "7days",
                dateRange: { startDate: startDateStr, endDate: endDateStr },
                totalEarnings: {
                    amount: roundedTotalEarnings,
                    count: totalEarningsCount,
                    totalTravelers: totalTravelersOverall,
                    description: `Total earnings from batches with start_date between ${startDateStr} and ${endDateStr}`
                },
                calculatedAt: now.toISOString(),
            }
        });
    } catch (error) {
        logger.error("wallet", "Error getting 7 days total earnings", { vendorId: req.user?.id, error: error.message });
        res.status(500).json({ success: false, message: "Failed to get 7 days total earnings", error: error.message });
    }
};

const getTotalEarnings30Days = async (req, res) => {
    try {
        const vendorId = req.user.id;
        
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const endDateStr = `${year}-${month}-${day}`;
        
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - 30); // 30 days before current date
        
        const startYear = startDate.getFullYear();
        const startMonth = String(startDate.getMonth() + 1).padStart(2, '0');
        const startDay = String(startDate.getDate()).padStart(2, '0');
        const startDateStr = `${startYear}-${startMonth}-${startDay}`;

        console.log(`🔍 30 DAYS TOTAL EARNINGS API - Date Range: ${startDateStr} to ${endDateStr}`);
        logger.info("wallet", "Getting 30 days total earnings", { vendorId, startDateStr, endDateStr });

        const batches = await Batch.findAll({
            where: {
                start_date: {
                    [Op.between]: [startDateStr, endDateStr]
                }
            },
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "vendor_id"],
                    where: { vendor_id: vendorId },
                    required: true,
                }
            ],
            order: [["start_date", "ASC"]]
        });

        console.log(`📊 30 DAYS TOTAL EARNINGS API - Found ${batches.length} batches`);

        let totalEarningsAmount = 0;
        let totalEarningsCount = 0;
        let totalTravelersOverall = 0;

        for (const batch of batches) {
            const bookings = await Booking.findAll({
                where: {
                    batch_id: batch.id,
                    vendor_id: vendorId,
                    status: {
                        [Op.in]: ["confirmed", "completed", "cancelled"]
                    }
                },
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        attributes: ["title", "base_price"]
                    }
                ]
            });

            if (bookings.length === 0) {
                continue;
            }

            for (const booking of bookings) {
                const trekBasePrice = parseFloat(booking.trek?.base_price || 0);
                const vendorDiscount = parseFloat(booking.vendor_discount || 0);
                const couponDiscount = parseFloat(booking.coupon_discount || 0);
                
                let earningsAmountPerPerson = trekBasePrice - vendorDiscount - couponDiscount;
                const totalTravelers = booking.total_travelers || 1;
                let earningsAmount = earningsAmountPerPerson * totalTravelers;

                let refundableAmount = 0;

                if (booking.status === "cancelled") {
                    const cancellationData = await CancellationBooking.findOne({
                        where: {
                            booking_id: booking.id,
                            trek_id: booking.trek_id,
                            batch_id: booking.batch_id
                        },
                        attributes: ["total_refundable_amount"]
                    });

                    if (cancellationData) {
                        refundableAmount = parseFloat(cancellationData.total_refundable_amount || 0) * totalTravelers;
                        earningsAmount -= refundableAmount;
                    }
                }

                totalEarningsAmount += earningsAmount;
                totalEarningsCount++;
                totalTravelersOverall += totalTravelers;
            }
        }

        console.log(`💰 30 DAYS TOTAL EARNINGS API - Total Earnings: ${totalEarningsAmount}, Count: ${totalEarningsCount}, Travelers: ${totalTravelersOverall}`);

        const roundedTotalEarnings = roundAmount(totalEarningsAmount);

        res.json({
            success: true,
            data: {
                period: "30days",
                dateRange: { startDate: startDateStr, endDate: endDateStr },
                totalEarnings: {
                    amount: roundedTotalEarnings,
                    count: totalEarningsCount,
                    totalTravelers: totalTravelersOverall,
                    description: `Total earnings from batches with start_date between ${startDateStr} and ${endDateStr}`
                },
                calculatedAt: now.toISOString(),
            }
        });
    } catch (error) {
        logger.error("wallet", "Error getting 30 days total earnings", { vendorId: req.user?.id, error: error.message });
        res.status(500).json({ success: false, message: "Failed to get 30 days total earnings", error: error.message });
    }
};

const getTotalEarningsYearly = async (req, res) => {
    try {
        const vendorId = req.user.id;
        
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const endDateStr = `${year}-${month}-${day}`;
        
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - 364); // 364 days before current date
        
        const startYear = startDate.getFullYear();
        const startMonth = String(startDate.getMonth() + 1).padStart(2, '0');
        const startDay = String(startDate.getDate()).padStart(2, '0');
        const startDateStr = `${startYear}-${startMonth}-${startDay}`;

        console.log(`🔍 YEARLY TOTAL EARNINGS API - Date Range: ${startDateStr} to ${endDateStr}`);
        logger.info("wallet", "Getting yearly total earnings", { vendorId, startDateStr, endDateStr });

        const batches = await Batch.findAll({
            where: {
                start_date: {
                    [Op.between]: [startDateStr, endDateStr]
                }
            },
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "vendor_id"],
                    where: { vendor_id: vendorId },
                    required: true,
                }
            ],
            order: [["start_date", "ASC"]]
        });

        console.log(`📊 YEARLY TOTAL EARNINGS API - Found ${batches.length} batches`);

        let totalEarningsAmount = 0;
        let totalEarningsCount = 0;
        let totalTravelersOverall = 0;

        for (const batch of batches) {
            const bookings = await Booking.findAll({
                where: {
                    batch_id: batch.id,
                    vendor_id: vendorId,
                    status: {
                        [Op.in]: ["confirmed", "completed", "cancelled"]
                    }
                },
                include: [
                    {
                        model: Trek,
                        as: "trek",
                        attributes: ["title", "base_price"]
                    }
                ]
            });

            if (bookings.length === 0) {
                continue;
            }

            for (const booking of bookings) {
                const trekBasePrice = parseFloat(booking.trek?.base_price || 0);
                const vendorDiscount = parseFloat(booking.vendor_discount || 0);
                const couponDiscount = parseFloat(booking.coupon_discount || 0);
                
                let earningsAmountPerPerson = trekBasePrice - vendorDiscount - couponDiscount;
                const totalTravelers = booking.total_travelers || 1;
                let earningsAmount = earningsAmountPerPerson * totalTravelers;

                let refundableAmount = 0;

                if (booking.status === "cancelled") {
                    const cancellationData = await CancellationBooking.findOne({
                        where: {
                            booking_id: booking.id,
                            trek_id: booking.trek_id,
                            batch_id: booking.batch_id
                        },
                        attributes: ["total_refundable_amount"]
                    });

                    if (cancellationData) {
                        refundableAmount = parseFloat(cancellationData.total_refundable_amount || 0) * totalTravelers;
                        earningsAmount -= refundableAmount;
                    }
                }

                totalEarningsAmount += earningsAmount;
                totalEarningsCount++;
                totalTravelersOverall += totalTravelers;
            }
        }

        console.log(`💰 YEARLY TOTAL EARNINGS API - Total Earnings: ${totalEarningsAmount}, Count: ${totalEarningsCount}, Travelers: ${totalTravelersOverall}`);

        res.json({
            success: true,
            data: {
                period: "yearly",
                dateRange: { startDate: startDateStr, endDate: endDateStr },
                totalEarnings: {
                    amount: totalEarningsAmount,
                    count: totalEarningsCount,
                    totalTravelers: totalTravelersOverall,
                    description: `Total earnings from batches with start_date between ${startDateStr} and ${endDateStr}`
                },
                calculatedAt: now.toISOString(),
            }
        });
    } catch (error) {
        logger.error("wallet", "Error getting yearly total earnings", { vendorId: req.user?.id, error: error.message });
        res.status(500).json({ success: false, message: "Failed to get yearly total earnings", error: error.message });
    }
};


module.exports = {
    getWalletBalance: exports.getWalletBalance,
    getWalletTransactions: exports.getWalletTransactions,
    createWithdrawal: exports.createWithdrawal,
    getWithdrawalHistory: exports.getWithdrawalHistory,
    getTbrBreakdown: exports.getTbrBreakdown,
    getLockedBalanceDetails: exports.getLockedBalanceDetails,
    getAvailableBalanceDetails: exports.getAvailableBalanceDetails,
    getTotalEarningsDetails: exports.getTotalEarningsDetails,
    getPendingRefundsDetails,
    getAnalytics7Days,
    getAnalytics30Days,
    getAnalyticsYearly,
    getTotalEarnings7Days,
    getTotalEarnings30Days,
    getTotalEarningsYearly,
    getTbrBreakdownDetailed: exports.getTbrBreakdownDetailed,
    createWithdrawalRequest: exports.createWithdrawalRequest,
    getWithdrawalHistoryNew: exports.getWithdrawalHistoryNew,
};
