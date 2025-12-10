const { Destination } = require("../../models");
const { Op } = require("sequelize");

// Get all destinations
const getAllDestinations = async (req, res) => {
    try {
        const { status } = req.query;
        const whereClause = status ? { status } : {};

        const destinations = await Destination.findAll({
            where: whereClause,
            order: [["name", "ASC"]],
        });
        res.json({
            success: true,
            data: { destinations },
        });
    } catch (error) {
        console.error("Error fetching destinations:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch destinations",
        });
    }
};

// Search destinations for autocomplete
const searchDestinations = async (req, res) => {
    try {
        const { q: searchTerm, limit = 10 } = req.query;

        if (!searchTerm || searchTerm.trim().length === 0) {
            return res.json({
                success: true,
                data: { destinations: [] },
            });
        }

        const destinations = await Destination.findAll({
            where: {
                [Op.or]: [
                    {
                        name: {
                            [Op.like]: `%${searchTerm}%`,
                        },
                    },
                    {
                        state: {
                            [Op.like]: `%${searchTerm}%`,
                        },
                    },
                ],
                status: "active",
            },
            attributes: ["id", "name", "isPopular", "state"],
            limit: parseInt(limit),
            order: [
                ["isPopular", "DESC"],
                ["name", "ASC"],
            ],
        });

        res.json({
            success: true,
            data: { destinations },
        });
    } catch (error) {
        console.error("Error searching destinations:", error);
        res.status(500).json({
            success: false,
            message: "Failed to search destinations",
        });
    }
};

// Get destination by ID
const getDestinationById = async (req, res) => {
    try {
        const { id } = req.params;
        const destination = await Destination.findByPk(id);

        if (!destination) {
            return res.status(404).json({ error: "Destination not found" });
        }

        res.json(destination);
    } catch (error) {
        console.error("Error fetching destination:", error);
        res.status(500).json({ error: "Failed to fetch destination" });
    }
};

// Create new destination
const createDestination = async (req, res) => {
    try {
        const { name, description, stateId, cityId } = req.body;

        if (!name || !stateId) {
            return res
                .status(400)
                .json({ error: "Name and state are required" });
        }

        const destination = await Destination.create({
            name,
            description,
            stateId,
            cityId,
        });

        res.status(201).json(destination);
    } catch (error) {
        console.error("Error creating destination:", error);
        res.status(500).json({ error: "Failed to create destination" });
    }
};

// Update destination
const updateDestination = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, stateId, cityId } = req.body;

        const destination = await Destination.findByPk(id);

        if (!destination) {
            return res.status(404).json({ error: "Destination not found" });
        }

        await destination.update({
            name,
            description,
            stateId,
            cityId,
        });

        res.json(destination);
    } catch (error) {
        console.error("Error updating destination:", error);
        res.status(500).json({ error: "Failed to update destination" });
    }
};

// Delete destination
const deleteDestination = async (req, res) => {
    try {
        const { id } = req.params;

        const destination = await Destination.findByPk(id);

        if (!destination) {
            return res.status(404).json({ error: "Destination not found" });
        }

        await destination.destroy();

        res.json({ message: "Destination deleted successfully" });
    } catch (error) {
        console.error("Error deleting destination:", error);
        res.status(500).json({ error: "Failed to delete destination" });
    }
};

// Toggle destination popularity
const togglePopularity = async (req, res) => {
    try {
        const { id } = req.params;

        const destination = await Destination.findByPk(id);

        if (!destination) {
            return res.status(404).json({ error: "Destination not found" });
        }

        await destination.update({
            isPopular: !destination.isPopular,
        });

        res.json(destination);
    } catch (error) {
        console.error("Error toggling destination popularity:", error);
        res.status(500).json({
            error: "Failed to toggle destination popularity",
        });
    }
};

// Get popular destinations
const getPopularDestinations = async (req, res) => {
    try {
        const destinations = await Destination.findAll({
            where: { isPopular: true },
            order: [["name", "ASC"]],
        });
        res.json(destinations);
    } catch (error) {
        console.error("Error fetching popular destinations:", error);
        res.status(500).json({ error: "Failed to fetch popular destinations" });
    }
};

module.exports = {
    getAllDestinations,
    searchDestinations,
    getDestinationById,
    createDestination,
    updateDestination,
    deleteDestination,
    togglePopularity,
    getPopularDestinations,
};
