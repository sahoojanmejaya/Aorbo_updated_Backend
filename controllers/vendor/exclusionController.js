const { Exclusion } = require("../../models");
const logger = require("../../utils/logger");

// Get all exclusions (popular ones first)
exports.getAllExclusions = async (req, res) => {
    try {
        const exclusions = await Exclusion.findAll({
            where: { is_active: true },
            order: [
                ["usage_count", "DESC"],
                ["name", "ASC"]
            ],
            limit: 10
        });

        logger.vendor("info", "Retrieved all exclusions", {
            count: exclusions.length,
            vendorId: req.user?.id
        });

        res.json({
            success: true,
            data: exclusions
        });
    } catch (error) {
        logger.vendor("error", "Failed to retrieve exclusions", {
            error: error.message,
            vendorId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to retrieve exclusions",
            error: error.message
        });
    }
};

// Search exclusions
exports.searchExclusions = async (req, res) => {
    try {
        const { search } = req.query;
        
        if (!search || search.trim() === "") {
            return res.json({
                success: true,
                data: []
            });
        }

        const searchTerm = search.trim();
        
        const exclusions = await Exclusion.findAll({
            where: {
                is_active: true,
                name: {
                    [require('sequelize').Op.like]: `%${searchTerm}%`
                }
            },
            order: [
                ["usage_count", "DESC"],
                ["name", "ASC"]
            ],
            limit: 10
        });

        logger.vendor("info", "Searched exclusions", {
            searchTerm,
            count: exclusions.length,
            vendorId: req.user?.id
        });

        res.json({
            success: true,
            data: exclusions
        });
    } catch (error) {
        logger.vendor("error", "Failed to search exclusions", {
            error: error.message,
            searchTerm: req.query.search,
            vendorId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to search exclusions",
            error: error.message
        });
    }
};

// Create new exclusion
exports.createExclusion = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || name.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Exclusion name is required"
            });
        }

        // Check if exclusion already exists (case-insensitive)
        const existingExclusion = await Exclusion.findOne({
            where: {
                name: { [require('sequelize').Op.like]: name.trim() },
                is_active: true
            }
        });

        if (existingExclusion) {
            // Return existing exclusion instead of error
            logger.vendor("info", "Exclusion already exists, returning existing", {
                exclusionId: existingExclusion.id,
                exclusionName: existingExclusion.name,
                vendorId: req.user?.id
            });

            return res.status(200).json({
                success: true,
                message: "Exclusion already exists",
                data: existingExclusion,
                isExisting: true
            });
        }

        const exclusion = await Exclusion.create({
            name: name.trim(),
            description: description?.trim() || null,
            usage_count: 0
        });

        logger.vendor("info", "Created new exclusion", {
            exclusionId: exclusion.id,
            exclusionName: exclusion.name,
            vendorId: req.user?.id
        });

        res.status(201).json({
            success: true,
            message: "Exclusion created successfully",
            data: exclusion
        });
    } catch (error) {
        logger.vendor("error", "Failed to create exclusion", {
            error: error.message,
            vendorId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to create exclusion",
            error: error.message
        });
    }
};

// Get exclusion by ID
exports.getExclusionById = async (req, res) => {
    try {
        const { id } = req.params;

        const exclusion = await Exclusion.findOne({
            where: {
                id,
                is_active: true
            }
        });

        if (!exclusion) {
            return res.status(404).json({
                success: false,
                message: "Exclusion not found"
            });
        }

        res.json({
            success: true,
            data: exclusion
        });
    } catch (error) {
        logger.vendor("error", "Failed to retrieve exclusion", {
            error: error.message,
            exclusionId: req.params.id,
            vendorId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to retrieve exclusion",
            error: error.message
        });
    }
};

// Update exclusion
exports.updateExclusion = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        const exclusion = await Exclusion.findOne({
            where: {
                id,
                is_active: true
            }
        });

        if (!exclusion) {
            return res.status(404).json({
                success: false,
                message: "Exclusion not found"
            });
        }

        // Check if new name conflicts with existing exclusion
        if (name && name.trim() !== exclusion.name) {
            const existingExclusion = await Exclusion.findOne({
                where: {
                    name: name.trim(),
                    is_active: true,
                    id: { [require('sequelize').Op.ne]: id }
                }
            });

            if (existingExclusion) {
                return res.status(400).json({
                    success: false,
                    message: "Exclusion with this name already exists"
                });
            }
        }

        await exclusion.update({
            name: name?.trim() || exclusion.name,
            description: description?.trim() || exclusion.description
        });

        logger.vendor("info", "Updated exclusion", {
            exclusionId: exclusion.id,
            exclusionName: exclusion.name,
            vendorId: req.user?.id
        });

        res.json({
            success: true,
            message: "Exclusion updated successfully",
            data: exclusion
        });
    } catch (error) {
        logger.vendor("error", "Failed to update exclusion", {
            error: error.message,
            exclusionId: req.params.id,
            vendorId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to update exclusion",
            error: error.message
        });
    }
};

// Delete exclusion (soft delete)
exports.deleteExclusion = async (req, res) => {
    try {
        const { id } = req.params;

        const exclusion = await Exclusion.findOne({
            where: {
                id,
                is_active: true
            }
        });

        if (!exclusion) {
            return res.status(404).json({
                success: false,
                message: "Exclusion not found"
            });
        }

        await exclusion.update({ is_active: false });

        logger.vendor("info", "Deleted exclusion", {
            exclusionId: exclusion.id,
            exclusionName: exclusion.name,
            vendorId: req.user?.id
        });

        res.json({
            success: true,
            message: "Exclusion deleted successfully"
        });
    } catch (error) {
        logger.vendor("error", "Failed to delete exclusion", {
            error: error.message,
            exclusionId: req.params.id,
            vendorId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to delete exclusion",
            error: error.message
        });
    }
}; 