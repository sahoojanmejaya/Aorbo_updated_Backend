const { State, City } = require("../../models");
const { Op, Sequelize } = require("sequelize");

// Get all states
exports.getAllStates = async (req, res) => {
    try {
        const states = await State.findAll({
            where: { status: "active" },
            include: [
                {
                    model: City,
                    as: "cities",
                    attributes: ["id", "cityName"],
                    where: { isPopular: true },
                    required: false,
                },
            ],
            order: [["name", "ASC"]],
        });
        res.json({ success: true, data: states });
    } catch (err) {
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
            include: [
                {
                    model: City,
                    as: "cities",
                    attributes: ["id", "cityName", "isPopular"],
                },
            ],
        });
        if (!state)
            return res
                .status(404)
                .json({ success: false, message: "State not found" });
        res.json({ success: true, data: state });
    } catch (err) {
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
            include: [
                {
                    model: City,
                    as: "cities",
                    attributes: ["id", "cityName"],
                    where: { isPopular: true },
                    required: true,
                },
            ],
            order: [["name", "ASC"]],
        });
        res.json({ success: true, data: states });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch popular states",
        });
    }
};

// Get states by region (placeholder - you can implement region logic)
exports.getStatesByRegion = async (req, res) => {
    try {
        const { region } = req.params;
        // For now, return all states. You can implement region-based filtering later
        const states = await State.findAll({
            where: { status: "active" },
            include: [
                {
                    model: City,
                    as: "cities",
                    attributes: ["id", "cityName"],
                },
            ],
            order: [["name", "ASC"]],
        });
        res.json({ success: true, data: states, region });
    } catch (err) {
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

// Create new state
exports.createState = async (req, res) => {
    try {
        const { name, description } = req.body;
        
        if (!name || name.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "State name is required"
            });
        }
        
        const trimmedName = name.trim();
        
        // Check for duplicate state name (case-insensitive)
        const existingState = await State.findOne({
            where: Sequelize.where(
                Sequelize.fn('LOWER', Sequelize.col('name')),
                Sequelize.fn('LOWER', trimmedName)
            )
        });
        
        if (existingState) {
            return res.status(400).json({
                success: false,
                message: `State '${trimmedName}' already exists`
            });
        }
        
        const newState = await State.create({
            name: trimmedName,
            description: description?.trim() || null,
            status: "active"
        });
        
        res.status(201).json({
            success: true,
            message: "State created successfully",
            data: newState
        });
    } catch (err) {
        console.error("Error creating state:", err);
        res.status(500).json({
            success: false,
            message: "Failed to create state",
            error: err.message
        });
    }
};

// Validate state name for real-time checking
exports.validateStateName = async (req, res) => {
    try {
        const { name } = req.query;
        
        if (!name || name.trim() === "") {
            return res.json({
                success: true,
                valid: false,
                message: "State name is required"
            });
        }
        
        const trimmedName = name.trim();
        
        if (trimmedName.length < 2) {
            return res.json({
                success: true,
                valid: false,
                message: "State name must be at least 2 characters"
            });
        }
        
        // Check for duplicate state name (case-insensitive)
        const existingState = await State.findOne({
            where: Sequelize.where(
                Sequelize.fn('LOWER', Sequelize.col('name')),
                Sequelize.fn('LOWER', trimmedName)
            )
        });
        
        if (existingState) {
            return res.json({
                success: true,
                valid: false,
                message: `State '${trimmedName}' already exists`
            });
        }
        
        // State is available - no message needed
        res.json({
            success: true,
            valid: true,
            message: ""
        });
    } catch (err) {
        console.error("Error validating state name:", err);
        res.status(500).json({
            success: false,
            message: "Failed to validate state name",
            error: err.message
        });
    }
};
