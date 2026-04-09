const {
    Traveler,
    Customer,
    BookingTraveler,
    Booking,
    Trek,
} = require("../../models");
const { Op } = require("sequelize");

// Get all travelers for a specific customer (vendor can only see travelers for customers who have booked their treks)
exports.getCustomerTravelers = async (req, res) => {
    try {
        const { id: customerId } = req.params;
        const vendorId = req.user.id;
        const { active_only = true } = req.query;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify that the customer has booked treks from this vendor
        const customerBookings = await Booking.findOne({
            where: {
                customer_id: customerId,
                vendor_id: vendorId,
            },
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title"],
                },
            ],
        });

        if (!customerBookings) {
            return res.status(404).json({
                success: false,
                message:
                    "Customer not found or has no bookings with this vendor",
            });
        }

        const whereClause = { customer_id: customerId };
        if (active_only === "true") {
            whereClause.is_active = true;
        }

        const travelers = await Traveler.findAll({
            where: whereClause,
            include: [
                {
                    model: BookingTraveler,
                    as: "bookingTravelers",
                    include: [
                        {
                            model: Booking,
                            as: "booking",
                            where: { vendor_id: vendorId },
                            include: [
                                {
                                    model: Trek,
                                    as: "trek",
                                    attributes: ["id", "title"],
                                },
                            ],
                        },
                    ],
                },
            ],
            order: [["created_at", "DESC"]],
        });

        // Transform the data to include booking information
        const transformedTravelers = travelers.map((traveler) => ({
            id: traveler.id,
            name: traveler.name,
            age: traveler.age,
            gender: traveler.gender,
            is_active: traveler.is_active,
            created_at: traveler.created_at,
            updated_at: traveler.updated_at,
            bookings: traveler.bookingTravelers
                .filter((bt) => bt.booking) // Only include bookings that exist
                .map((bt) => ({
                    booking_id: bt.booking.id,
                    trek_title: bt.booking.trek?.title || "Unknown Trek",
                    booking_date: bt.booking.booking_date,
                    status: bt.booking.status,
                    final_amount: bt.booking.final_amount,
                })),
            total_bookings: traveler.bookingTravelers.filter((bt) => bt.booking)
                .length,
        }));

        res.json({
            success: true,
            data: transformedTravelers,
        });
    } catch (error) {
        console.error("Error fetching customer travelers:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch travelers",
        });
    }
};

// Get traveler details for a specific customer
exports.getTravelerDetails = async (req, res) => {
    try {
        const { customerId, travelerId } = req.params;
        const vendorId = req.user.id;

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Verify that the customer has booked treks from this vendor
        const customerBookings = await Booking.findOne({
            where: {
                customer_id: customerId,
                vendor_id: vendorId,
            },
        });

        if (!customerBookings) {
            return res.status(404).json({
                success: false,
                message:
                    "Customer not found or has no bookings with this vendor",
            });
        }

        const traveler = await Traveler.findOne({
            where: {
                id: travelerId,
                customer_id: customerId,
            },
            include: [
                {
                    model: BookingTraveler,
                    as: "bookingTravelers",
                    include: [
                        {
                            model: Booking,
                            as: "booking",
                            where: { vendor_id: vendorId },
                            include: [
                                {
                                    model: Trek,
                                    as: "trek",
                                    attributes: ["id", "title"],
                                },
                            ],
                        },
                    ],
                },
            ],
        });

        if (!traveler) {
            return res.status(404).json({
                success: false,
                message: "Traveler not found",
            });
        }

        // Transform the data
        const transformedTraveler = {
            id: traveler.id,
            name: traveler.name,
            age: traveler.age,
            gender: traveler.gender,
            is_active: traveler.is_active,
            created_at: traveler.created_at,
            updated_at: traveler.updated_at,
            bookings: traveler.bookingTravelers
                .filter((bt) => bt.booking)
                .map((bt) => ({
                    booking_id: bt.booking.id,
                    trek_title: bt.booking.trek?.title || "Unknown Trek",
                    booking_date: bt.booking.booking_date,
                    status: bt.booking.status,
                    final_amount: bt.booking.final_amount,
                })),
            total_bookings: traveler.bookingTravelers.filter((bt) => bt.booking)
                .length,
        };

        res.json({
            success: true,
            data: transformedTraveler,
        });
    } catch (error) {
        console.error("Error fetching traveler details:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch traveler details",
        });
    }
};
