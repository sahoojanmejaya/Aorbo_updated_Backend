const { IssueReport, Booking } = require("../../models");

/**
 * Get dispute status and disputed amount by booking ID
 * GET /api/v1/booking-dispute/:bookingId
 * Returns ALL disputes for the booking ID
 */
const getBookingDisputeStatus = async (req, res) => {
    try {
        const { bookingId } = req.params;

        console.log('=== GET BOOKING DISPUTE STATUS CALLED ===');
        console.log('Booking ID:', bookingId);

        // Validate booking ID
        if (!bookingId || isNaN(bookingId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking ID provided"
            });
        }

        // Find ALL disputes by booking ID
        const disputes = await IssueReport.findAll({
            where: { booking_id: bookingId },
            include: [
                {
                    model: Booking,
                    as: "booking",
                    attributes: ['id', 'status', 'final_amount']
                }
            ],
            order: [['created_at', 'DESC']] // Most recent disputes first
        });

        if (!disputes || disputes.length === 0) {
            // Fetch booking information even when no disputes exist
            const booking = await Booking.findByPk(bookingId, {
                attributes: ['id', 'status', 'final_amount']
            });

            return res.status(200).json({
                success: true,
                message: "No disputes found for this booking",
                data: {
                    booking_id: parseInt(bookingId),
                    total_disputes: 0,
                    total_disputed_amount: "0.00",
                    overall_status: null,
                    overall_priority: null,
                    booking_status: booking?.status || null,
                    booking_amount: booking?.final_amount || null,
                    disputes: [],
                    latest_dispute: null
                }
            });
        }

        // Calculate total disputed amount across all disputes
        const totalDisputedAmount = disputes.reduce((sum, dispute) => {
            return sum + (parseFloat(dispute.disputed_amount) || 0);
        }, 0);

        // Determine overall dispute status
        const statusPriority = {
            'urgent': 4,
            'high': 3,
            'medium': 2,
            'low': 1
        };

        const statusOrder = {
            'open': 4,
            'in_progress': 3,
            'pending': 2,
            'resolved': 1,
            'closed': 0
        };

        // Get the highest priority dispute
        const highestPriorityDispute = disputes.reduce((highest, current) => {
            const currentPriority = statusPriority[current.priority] || 0;
            const highestPriority = statusPriority[highest.priority] || 0;
            
            if (currentPriority > highestPriority) {
                return current;
            } else if (currentPriority === highestPriority) {
                // If same priority, check status
                const currentStatus = statusOrder[current.status] || 0;
                const highestStatus = statusOrder[highest.status] || 0;
                return currentStatus > highestStatus ? current : highest;
            }
            return highest;
        });

        // Return comprehensive dispute information
        res.json({
            success: true,
            data: {
                booking_id: parseInt(bookingId),
                total_disputes: disputes.length,
                total_disputed_amount: totalDisputedAmount.toFixed(2),
                overall_status: highestPriorityDispute.status,
                overall_priority: highestPriorityDispute.priority,
                booking_status: disputes[0].booking.status,
                booking_amount: disputes[0].booking.final_amount,
                disputes: disputes.map(dispute => ({
                    dispute_id: dispute.id,
                    issue_type: dispute.issue_type,
                    issue_category: dispute.issue_category,
                    status: dispute.status,
                    priority: dispute.priority,
                    disputed_amount: dispute.disputed_amount || 0.00,
                    description: dispute.description,
                    created_at: dispute.created_at,
                    updated_at: dispute.updated_at,
                    resolved_at: dispute.resolved_at
                })),
                latest_dispute: {
                    dispute_id: disputes[0].id,
                    issue_type: disputes[0].issue_type,
                    status: disputes[0].status,
                    priority: disputes[0].priority,
                    created_at: disputes[0].created_at
                }
            }
        });

    } catch (error) {
        console.error("Error fetching booking dispute status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch dispute information",
            error: error.message || "Something went wrong"
        });
    }
};

/**
 * Update dispute status by booking ID with proper flow logic
 * PUT /api/v1/booking-dispute/:bookingId/status
 */
const updateBookingDisputeStatus = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { status } = req.body;

        console.log('=== UPDATE BOOKING DISPUTE STATUS CALLED ===');
        console.log('Booking ID:', bookingId);
        console.log('New Status:', status);

        // Validate booking ID
        if (!bookingId || isNaN(bookingId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking ID provided"
            });
        }

        // Validate status
        const validStatuses = ['pending', 'open', 'in_progress', 'resolved', 'closed'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status provided",
                validStatuses: validStatuses
            });
        }

        // Find dispute by booking ID
        const dispute = await IssueReport.findOne({
            where: { booking_id: bookingId },
            include: [
                {
                    model: Booking,
                    as: "booking",
                    attributes: ['id', 'status', 'final_amount']
                }
            ]
        });

        if (!dispute) {
            return res.status(404).json({
                success: false,
                message: "No dispute found for this booking"
            });
        }

        // Define status flow logic
        const statusFlow = {
            'pending': ['open'],
            'open': ['in_progress'],
            'in_progress': ['resolved', 'closed'],
            'resolved': [], // Terminal state
            'closed': [] // Terminal state
        };

        // Check if status transition is valid
        const currentStatus = dispute.status;
        const allowedTransitions = statusFlow[currentStatus] || [];
        
        if (!allowedTransitions.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status transition from '${currentStatus}' to '${status}'`,
                currentStatus: currentStatus,
                allowedTransitions: allowedTransitions
            });
        }

        // Update the status
        await dispute.update({
            status: status,
            updated_at: new Date()
        });

        // If status is resolved or closed, set resolved_at timestamp
        if (status === 'resolved' || status === 'closed') {
            await dispute.update({
                resolved_at: new Date()
            });
        }

        // Return updated dispute information
        res.json({
            success: true,
            message: `Dispute status updated to '${status}' successfully`,
            data: {
                booking_id: parseInt(bookingId),
                dispute_status: status,
                previous_status: currentStatus,
                disputed_amount: dispute.disputed_amount || 0.00,
                booking_status: dispute.booking.status,
                booking_amount: dispute.booking.final_amount,
                issue_type: dispute.issue_type,
                priority: dispute.priority,
                created_at: dispute.created_at,
                updated_at: dispute.updated_at,
                resolved_at: dispute.resolved_at
            }
        });

    } catch (error) {
        console.error("Error updating booking dispute status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update dispute status",
            error: error.message || "Something went wrong"
        });
    }
};

module.exports = {
    getBookingDisputeStatus,
    updateBookingDisputeStatus
};
