const { State, City } = require("../../models");
const { Op } = require("sequelize");

// Get all states
exports.getAllStates = async (req, res) => {
    try {
        const states = await State.findAll({
            where: { status: "active" },
            attributes: ["id", "name"],
            order: [["name", "ASC"]],
        });
        res.json({ success: true, data: states });
    } catch (err) {
        console.error("Error fetching states:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch states",
        });
    }
};

// Get state by ID
exports.getStateById = async (req, res) => {
    try {
        const state = await State.findByPk(req.params.id, {
            attributes: ["id", "name"],
        });
        if (!state)
            return res
                .status(404)
                .json({ success: false, message: "State not found" });
        res.json({ success: true, data: state });
    } catch (err) {
        console.error("Error fetching state:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch state",
        });
    }
};

// Get popular states
exports.getPopularStates = async (req, res) => {
    try {
        const states = await State.findAll({
            where: { status: "active" },
            attributes: ["id", "name"],
            order: [["name", "ASC"]],
        });
        res.json({ success: true, data: states });
    } catch (err) {
        console.error("Error fetching popular states:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch popular states",
        });
    }
};

// Get states by region
exports.getStatesByRegion = async (req, res) => {
    try {
        const { region } = req.params;
        // For now, return all states. You can implement region-based filtering later
        const states = await State.findAll({
            where: { status: "active" },
            attributes: ["id", "name"],
            order: [["name", "ASC"]],
        });
        res.json({ success: true, data: states, region });
    } catch (err) {
        console.error("Error fetching states by region:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch states by region",
        });
    }
};

// Search states for autocomplete
exports.searchStates = async (req, res) => {
    try {
        const { q: searchTerm, limit = 10 } = req.query;

        if (!searchTerm || searchTerm.length < 2) {
            return res.json({
                success: true,
                data: { states: [] },
            });
        }

        const states = await State.findAll({
            where: {
                name: {
                    [Op.like]: `%${searchTerm}%`,
                },
                status: "active",
            },
            attributes: ["id", "name"],
            limit: parseInt(limit),
            order: [["name", "ASC"]],
        });

        res.json({
            success: true,
            data: { states },
        });
    } catch (error) {
        console.error("Error searching states:", error);
        res.status(500).json({
            success: false,
            message: "Failed to search states",
        });
    }
};
