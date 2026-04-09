const { IssueReport, Booking } = require("../../models");

/**
 * Get dispute information by booking ID for vendor
 * GET /api/vendor/booking-dispute/:bookingId
 */
const getBookingDisputeInfo = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const vendorId = req.user.id; // Get vendor ID from authenticated user

        console.log('=== GET BOOKING DISPUTE INFO CALLED ===');
        console.log('Booking ID:', bookingId);
        console.log('Vendor ID:', vendorId);

        // Find dispute by booking ID and ensure it belongs to this vendor
        const dispute = await IssueReport.findOne({
            where: { booking_id: bookingId },
            include: [
                {
                    model: Booking,
                    as: "booking",
                    where: { vendor_id: vendorId }, // Ensure this booking belongs to this vendor
                    required: true
                }
            ]
        });

        if (!dispute) {
            return res.status(404).json({
                success: false,
                message: "No dispute found for this booking or access denied"
            });
        }

        // Fetch disputed_amount using raw SQL
        const disputedAmountResult = await IssueReport.sequelize.query(
            'SELECT disputed_amount FROM issue_reports WHERE booking_id = :bookingId',
            {
                replacements: { bookingId },
                type: IssueReport.sequelize.QueryTypes.SELECT
            }
        );
        const disputedAmount = disputedAmountResult[0]?.disputed_amount || null;

        res.json({
            success: true,
            data: {
                booking_id: bookingId,
                dispute_status: dispute.status,
                disputed_amount: disputedAmount
            }
        });

    } catch (error) {
        console.error("Error fetching booking dispute info:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch dispute information",
            error: error.message || "Something went wrong"
        });
    }
};

module.exports = {
    getBookingDisputeInfo
};
