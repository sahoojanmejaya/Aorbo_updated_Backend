const { Traveler, Customer, BookingTraveler, Booking } = require("../../models");
const { Op } = require("sequelize");

// Get all travelers with customer info
const getAllTravelers = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            customer_id,
            is_active,
            search,
            sort_by = "created_at",
            sort_order = "DESC",
        } = req.query;

        const offset = (page - 1) * limit;
        const whereClause = {};

        if (customer_id) whereClause.customer_id = customer_id;

        if (is_active !== undefined) {
            whereClause.is_active = is_active === "true";
        }

        if (search) {
            whereClause[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
            ];
        }

        const { count, rows: travelers } = await Traveler.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name", "email", "phone"],
                    required: false,
                },
            ],
            order: [[sort_by, sort_order.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset),
        });

        res.json({
            success: true,
            data: {
                travelers,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: Math.ceil(count / limit),
                    total_items: count,
                    items_per_page: parseInt(limit),
                },
            },
        });
    } catch (error) {
        console.error("Error fetching travelers:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch travelers",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

// Get traveler stats
const getTravelerStats = async (req, res) => {
    try {
        const totalTravelers = await Traveler.count();
        const activeTravelers = await Traveler.count({ where: { is_active: true } });
        const inactiveTravelers = await Traveler.count({ where: { is_active: false } });

        const customersWithTravelers = await Traveler.count({
            distinct: true,
            col: "customer_id",
            where: { is_active: true },
        });

        const genderBreakdown = await Traveler.findAll({
            attributes: [
                "gender",
                [Traveler.sequelize.fn("COUNT", Traveler.sequelize.col("id")), "count"],
            ],
            where: { is_active: true },
            group: ["gender"],
        });

        res.json({
            success: true,
            data: {
                total_travelers: totalTravelers,
                active_travelers: activeTravelers,
                inactive_travelers: inactiveTravelers,
                customers_with_travelers: customersWithTravelers,
                gender_breakdown: genderBreakdown,
            },
        });
    } catch (error) {
        console.error("Error fetching traveler stats:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch traveler statistics",
        });
    }
};

// Get all travelers for a specific customer
const getCustomerTravelers = async (req, res) => {
    try {
        const { customerId } = req.params;

        const customer = await Customer.findByPk(customerId, {
            attributes: ["id", "name", "email", "phone"],
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found",
            });
        }

        const travelers = await Traveler.findAll({
            where: { customer_id: customerId },
            order: [["created_at", "ASC"]],
        });

        res.json({
            success: true,
            data: { customer, travelers },
        });
    } catch (error) {
        console.error("Error fetching customer travelers:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch customer travelers",
        });
    }
};

// Get single traveler with booking history
const getTravelerById = async (req, res) => {
    try {
        const { id } = req.params;

        const traveler = await Traveler.findByPk(id, {
            include: [
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name", "email", "phone"],
                },
                {
                    model: BookingTraveler,
                    as: "bookingTravelers",
                    include: [
                        {
                            model: Booking,
                            as: "booking",
                            attributes: ["id", "booking_reference", "status", "total_amount", "created_at"],
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
        console.error("Error fetching traveler:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch traveler",
        });
    }
};

// Update traveler
const updateTraveler = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, age, gender, is_active } = req.body;

        const traveler = await Traveler.findByPk(id);

        if (!traveler) {
            return res.status(404).json({
                success: false,
                message: "Traveler not found",
            });
        }

        if (name !== undefined) traveler.name = name;
        if (age !== undefined) traveler.age = age;
        if (gender !== undefined) traveler.gender = gender;
        if (is_active !== undefined) traveler.is_active = is_active;

        await traveler.save();

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

// Soft-delete traveler
const deleteTraveler = async (req, res) => {
    try {
        const { id } = req.params;

        const traveler = await Traveler.findByPk(id);

        if (!traveler) {
            return res.status(404).json({
                success: false,
                message: "Traveler not found",
            });
        }

        traveler.is_active = false;
        await traveler.save();

        res.json({
            success: true,
            message: "Traveler deactivated successfully",
        });
    } catch (error) {
        console.error("Error deleting traveler:", error);
        res.status(500).json({
            success: false,
            message: "Failed to deactivate traveler",
        });
    }
};

module.exports = {
    getAllTravelers,
    getTravelerStats,
    getCustomerTravelers,
    getTravelerById,
    updateTraveler,
    deleteTraveler,
};
