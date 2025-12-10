const { Destination, Trek } = require("../../models");

// Get all destinations
exports.getAllDestinations = async (req, res) => {
    try {
        const { status } = req.query;
        const whereClause = status ? { status } : { status: "active" };

        const destinations = await Destination.findAll({
            where: whereClause,
            attributes: ["id", "name", "isPopular"],
            order: [["name", "ASC"]],
        });
        res.json({
            success: true,
            data: destinations,
        });
    } catch (error) {
        console.error("Error fetching destinations:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch destinations",
        });
    }
};

// Get destination by ID
exports.getDestinationById = async (req, res) => {
    try {
        const { id } = req.params;
        const destination = await Destination.findByPk(id, {
            attributes: ["id", "name", "isPopular"],
        });

        if (!destination) {
            return res.status(404).json({
                success: false,
                message: "Destination not found",
            });
        }

        res.json({ success: true, data: destination });
    } catch (error) {
        console.error("Error fetching destination:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch destination",
        });
    }
};

// Get popular destinations
exports.getPopularDestinations = async (req, res) => {
    try {
        const destinations = await Destination.findAll({
            where: {
                isPopular: true,
                status: "active",
            },
            attributes: ["id", "name", "isPopular"],
            order: [["name", "ASC"]],
        });
        res.json({ success: true, data: destinations });
    } catch (error) {
        console.error("Error fetching popular destinations:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch popular destinations",
        });
    }
};

// Get destinations by state
exports.getDestinationsByState = async (req, res) => {
    try {
        const { state } = req.params;
        const destinations = await Destination.findAll({
            where: {
                state,
                status: "active",
            },
            attributes: ["id", "name", "isPopular"],
            order: [["name", "ASC"]],
        });
        res.json({ success: true, data: destinations });
    } catch (error) {
        console.error("Error fetching destinations by state:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch destinations by state",
        });
    }
};
