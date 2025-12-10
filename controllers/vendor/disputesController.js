const { Op } = require('sequelize');
const { IssueReport, Booking, Trek, Batch, CancellationBooking } = require('../../models');
const logger = require('../../utils/logger');
const { roundAmount } = require('../../utils/amountUtils');

/**
 * Get disputes data for vendor wallet page
 * @route GET /api/vendor/wallet/disputes
 * @access Private (Vendor)
 */
const getDisputesData = async (req, res) => {
    try {
        const vendorId = req.user.id;

        logger.info("wallet", "Getting disputes data", { vendorId });

        // Get all issue reports for this vendor
        const issueReports = await IssueReport.findAll({
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

        console.log(`📊 Found ${issueReports.length} issue reports for vendor ${vendorId}`);

        const activeDisputes = [];
        const resolvedDisputes = [];

        for (const issueReport of issueReports) {
            const booking = issueReport.booking;
            const trekBasePrice = parseFloat(booking.trek?.base_price || 0);
            const vendorDiscount = parseFloat(booking.vendor_discount || 0);
            const couponDiscount = parseFloat(booking.coupon_discount || 0);
            const totalTravelers = booking.total_travelers || 1;

            console.log(`🔍 Processing dispute ${issueReport.id}:`, {
                bookingId: booking.id,
                status: issueReport.status,
                trekBasePrice,
                vendorDiscount,
                couponDiscount,
                totalTravelers,
                bookingStatus: booking.status,
                sla: issueReport.sla
            });

            // Check if dispute should be auto-resolved due to SLA
            let shouldAutoResolve = false;
            let autoResolveReason = null;

            // Case 1: SLA is null - auto resolve
            if (!issueReport.sla && issueReport.status !== 'resolved') {
                shouldAutoResolve = true;
                autoResolveReason = "Resolved - No SLA defined";
                console.log(`⚠️ Dispute ${issueReport.id} has null SLA - auto-resolving`);
            }
            // Case 2: SLA has expired - auto resolve
            else if (issueReport.sla && issueReport.status !== 'resolved') {
                const slaString = issueReport.sla.toString();
                const slaMatch = slaString.match(/\d+/);
                if (slaMatch) {
                    const slaHours = parseInt(slaMatch[0]);
                    const now = new Date();
                    const disputeRaisedTime = new Date(issueReport.created_at);
                    const slaExpiryTime = new Date(disputeRaisedTime.getTime() + slaHours * 60 * 60 * 1000);

                    if (now > slaExpiryTime) {
                        shouldAutoResolve = true;
                        autoResolveReason = "Resolution completed after expiry";
                        console.log(`⏰ Dispute ${issueReport.id} SLA expired (${slaHours}h) - auto-resolving`);
                    }
                }
            }

            // If should auto-resolve, update the issue report in database
            if (shouldAutoResolve) {
                try {
                    await issueReport.update({
                        status: 'resolved',
                        resolution_notes: autoResolveReason,
                        resolved_at: new Date(),
                        disputed_amount: 0 // Set to 0 as resolved in customer's favor
                    });
                    console.log(`✅ Dispute ${issueReport.id} auto-resolved successfully`);
                    // Update the in-memory object to reflect changes
                    issueReport.status = 'resolved';
                    issueReport.resolution_notes = autoResolveReason;
                    issueReport.resolved_at = new Date();
                    issueReport.disputed_amount = 0;
                } catch (error) {
                    console.error(`❌ Error auto-resolving dispute ${issueReport.id}:`, error);
                }
            }

            // Calculate dispute amount based on status
            let disputeAmount = 0;
            let disputeAmountPerPerson = 0;

            if (issueReport.status === 'resolved') {
                // For resolved disputes, use disputed_amount from issue_reports table
                disputeAmount = parseFloat(issueReport.disputed_amount || 0);
                disputeAmountPerPerson = disputeAmount;
                console.log(`✅ Resolved dispute amount: ${disputeAmount} (from disputed_amount)`);
            } else {
                // For active disputes, calculate using pending refunds logic
                disputeAmountPerPerson = trekBasePrice - vendorDiscount - couponDiscount;
                console.log(`📊 Active dispute calculation step 1: ${trekBasePrice} - ${vendorDiscount} - ${couponDiscount} = ${disputeAmountPerPerson}`);

                // If booking is cancelled, subtract total_refundable_amount
                if (booking.status === "cancelled") {
                    const cancellationData = await CancellationBooking.findOne({
                        where: { 
                            booking_id: booking.id, 
                            trek_id: booking.trek_id, 
                            batch_id: booking.batch_id 
                        },
                        attributes: ["total_refundable_amount"],
                    });
                    const refundableAmount = parseFloat(cancellationData?.total_refundable_amount || 0);
                    disputeAmountPerPerson -= refundableAmount;
                    console.log(`📊 Active dispute calculation step 2: ${disputeAmountPerPerson} - ${refundableAmount} = ${disputeAmountPerPerson}`);
                }

                disputeAmount = disputeAmountPerPerson * totalTravelers;
                console.log(`📊 Final active dispute amount: ${disputeAmountPerPerson} * ${totalTravelers} = ${disputeAmount}`);
            }

            // Parse SLA hours from sla field (could be "72", "72 hours", or just number)
            let slaHours = null; // Default to null if not provided
            if (issueReport.sla) {
                const slaString = issueReport.sla.toString();
                const slaMatch = slaString.match(/\d+/); // Extract first number from string
                if (slaMatch) {
                    slaHours = parseInt(slaMatch[0]);
                }
            }

            const disputeData = {
                id: issueReport.id,
                dispute_id: `DISP${issueReport.id.toString().padStart(3, '0')}`,
                booking_id: booking.id,
                amount: roundAmount(disputeAmount || 0),
                amount_per_person: roundAmount(disputeAmountPerPerson || 0),
                total_travelers: totalTravelers,
                reason: issueReport.description || issueReport.issue_type || 'No description provided',
                status: issueReport.status,
                issue_type: issueReport.issue_type,
                issue_category: issueReport.issue_category,
                priority: issueReport.priority,
                sla: issueReport.sla,
                sla_hours: slaHours,
                created_at: issueReport.created_at,
                updated_at: issueReport.updated_at,
                trek_title: booking.trek?.title,
                batch_tbr_id: booking.batch?.tbr_id,
                batch_start_date: booking.batch?.start_date,
                booking_status: booking.status,
            };

            // Add resolution notes for resolved disputes
            if (issueReport.status === 'resolved') {
                disputeData.resolution_notes = issueReport.resolution_notes || 'Resolution completed';
                disputeData.resolved_at = issueReport.resolved_at || issueReport.updated_at;
                resolvedDisputes.push(disputeData);
            } else {
                // Active disputes (in_progress, pending, open)
                activeDisputes.push(disputeData);
            }
        }

        console.log(`📊 Active disputes: ${activeDisputes.length}, Resolved disputes: ${resolvedDisputes.length}`);

        const response = {
            success: true,
            data: {
                active: {
                    count: activeDisputes.length,
                    disputes: activeDisputes,
                    description: "Disputes with status: in_progress, pending, open"
                },
                resolved: {
                    count: resolvedDisputes.length,
                    disputes: resolvedDisputes,
                    description: "Disputes with status: resolved"
                },
                calculationFormula: {
                    active: "Dispute amount = (base_price - vendor_discount - coupon_discount - total_refundable_amount(if cancelled)) * total_travelers",
                    resolved: "Dispute amount = disputed_amount from issue_reports table"
                },
                totalDisputes: issueReports.length,
                lastUpdated: new Date().toISOString()
            }
        };

        res.json(response);

    } catch (error) {
        logger.error("wallet", "Error getting disputes data", { 
            vendorId: req.user?.id, 
            error: error.message 
        });
        res.status(500).json({
            success: false,
            message: "Failed to get disputes data",
            error: error.message
        });
    }
};

module.exports = {
    getDisputesData
};
