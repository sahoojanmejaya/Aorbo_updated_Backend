const {
    Traveler,
    Customer,
    BookingTraveler,
    Booking,
} = require("../../models");
const { Op } = require("sequelize");

// Get all travelers for a customer
exports.getTravelers = async (req, res) => {
    try {
        const customerId = req.customer.id;
        const { active_only = true } = req.query;

        const whereClause = { customer_id: customerId };
        if (active_only === "true") {
            whereClause.is_active = true;
        }

        const travelers = await Traveler.findAll({
            where: whereClause,
            order: [["created_at", "DESC"]],
        });

        res.json({
            success: true,
            data: travelers,
        });
    } catch (error) {
        console.error("Error fetching travelers:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch travelers",
        });
    }
};

// Create a new traveler
exports.createTraveler = async (req, res) => {
    try {
        const customerId = req.customer.id;
        const { name, age, gender } = req.body;

        // Validate required fields
        if (!name || !age || !gender) {
            return res.status(400).json({
                success: false,
                message: "Name, age and gender are required",
            });
        }

        // Check if this is the first traveler for this customer
        const existingTravelersCount = await Traveler.count({
            where: { 
                customer_id: customerId,
                is_active: true 
            }
        });

        const traveler = await Traveler.create({
            customer_id: customerId,
            name,
            age,
            gender,
        });

        // If this is the first traveler, update customer info
        if (existingTravelersCount === 0) {
            await Customer.update(
                {
                    name: name,
                    age: parseInt(age),
                    gender: gender,
                },
                {
                    where: { id: customerId }
                }
            );
            
            console.log(`Updated customer ${customerId} with first traveler info: ${name}, ${age}, ${gender}`);
        }

        res.status(201).json({
            success: true,
            message: "Traveler created successfully",
            data: traveler,
        });
    } catch (error) {
        console.error("Error creating traveler:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create traveler",
        });
    }
};

// Get traveler details
exports.getTravelerDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const customerId = req.customer.id;

        const traveler = await Traveler.findOne({
            where: {
                id: id,
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
                            attributes: [
                                "id",
                                "status",
                                "booking_date",
                                "final_amount",
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

        res.json({
            success: true,
            data: traveler,
        });
    } catch (error) {
        console.error("Error fetching traveler details:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch traveler details",
        });
    }
};

// Update traveler
exports.updateTraveler = async (req, res) => {
    try {
        const { id } = req.params;
        const customerId = req.customer.id;

        const traveler = await Traveler.findOne({
            where: {
                id: id,
                customer_id: customerId,
                is_active: true,
            },
        });

        if (!traveler) {
            return res.status(404).json({
                success: false,
                message: "Traveler not found",
            });
        }

        // Check if traveler has active bookings
        const activeBookings = await BookingTraveler.count({
            where: {
                traveler_id: id,
                status: { [Op.in]: ["confirmed"] },
            },
            include: [
                {
                    model: Booking,
                    as: "booking",
                    where: { status: { [Op.in]: ["pending", "confirmed"] } },
                },
            ],
        });

        // Restrict certain updates if traveler has active bookings
        const restrictedFields = ["name", "age", "gender"];
        const hasRestrictedUpdates = restrictedFields.some(
            (field) => req.body[field] !== undefined
        );

        if (activeBookings > 0 && hasRestrictedUpdates) {
            return res.status(400).json({
                success: false,
                message:
                    "Cannot update name, age, or gender for travelers with active bookings",
            });
        }

        const allowedUpdates = ["name", "age", "gender"];

        const updates = {};
        allowedUpdates.forEach((field) => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        await traveler.update(updates);

        res.json({
            success: true,
            message: "Traveler updated successfully",
            data: traveler,
        });
    } catch (error) {
        console.error("Error updating traveler:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update traveler",
        });
    }
};

// Delete (deactivate) traveler
exports.deleteTraveler = async (req, res) => {
    try {
        const { id } = req.params;
        const customerId = req.customer.id;

        const traveler = await Traveler.findOne({
            where: {
                id: id,
                customer_id: customerId,
                is_active: true,
            },
        });

        if (!traveler) {
            return res.status(404).json({
                success: false,
                message: "Traveler not found",
            });
        }

        // Check for active bookings
        const activeBookings = await BookingTraveler.count({
            where: {
                traveler_id: id,
                status: { [Op.in]: ["confirmed"] },
            },
            include: [
                {
                    model: Booking,
                    as: "booking",
                    where: { status: { [Op.in]: ["pending", "confirmed"] } },
                },
            ],
        });

        if (activeBookings > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete traveler with active bookings",
            });
        }

        // Soft delete by setting is_active to false
        await traveler.update({ is_active: false });

        res.json({
            success: true,
            message: "Traveler deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting traveler:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete traveler",
        });
    }
};

// Get traveler booking history
exports.getTravelerBookings = async (req, res) => {
    try {
        const { id } = req.params;
        const customerId = req.customer.id;
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        // Verify traveler ownership
        const traveler = await Traveler.findOne({
            where: {
                id: id,
                customer_id: customerId,
            },
        });

        if (!traveler) {
            return res.status(404).json({
                success: false,
                message: "Traveler not found",
            });
        }

        const { count, rows: bookingTravelers } =
            await BookingTraveler.findAndCountAll({
                where: { traveler_id: id },
                include: [
                    {
                        model: Booking,
                        as: "booking",
                        include: ["trek", "vendor", "batch"],
                    },
                ],
                order: [["created_at", "DESC"]],
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

        res.json({
            success: true,
            data: {
                traveler,
                bookings: bookingTravelers.map((bt) => ({
                    ...bt.booking.toJSON(),
                    traveler_details: {
                        is_primary: bt.is_primary,
                        special_requirements: bt.special_requirements,
                        accommodation_preference: bt.accommodation_preference,
                        meal_preference: bt.meal_preference,
                        status: bt.status,
                    },
                })),
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(count / limit),
                    totalBookings: count,
                    hasNext: offset + bookingTravelers.length < count,
                    hasPrev: page > 1,
                },
            },
        });
    } catch (error) {
        console.error("Error fetching traveler bookings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch traveler bookings",
        });
    }
};
