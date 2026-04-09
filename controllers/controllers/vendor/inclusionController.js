const { Inclusion } = require("../../models");
const logger = require("../../utils/logger");

// Get all inclusions (popular ones first)
exports.getAllInclusions = async (req, res) => {
    try {
        const inclusions = await Inclusion.findAll({
            where: { is_active: true },
            order: [
                ["usage_count", "DESC"],
                ["name", "ASC"]
            ],
            limit: 1000
        });

        logger.vendor("info", "Retrieved all inclusions", {
            count: inclusions.length,
            vendorId: req.user?.id
        });

        res.json({
            success: true,
            data: inclusions
        });
    } catch (error) {
        logger.vendor("error", "Failed to retrieve inclusions", {
            error: error.message,
            vendorId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to retrieve inclusions",
            error: error.message
        });
    }
};

// Search inclusions
exports.searchInclusions = async (req, res) => {
    try {
        const { search } = req.query;
        
        if (!search || search.trim() === "") {
            return res.json({
                success: true,
                data: []
            });
        }

        const searchTerm = search.trim();
        
        const inclusions = await Inclusion.findAll({
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

        logger.vendor("info", "Searched inclusions", {
            searchTerm,
            count: inclusions.length,
            vendorId: req.user?.id
        });

        res.json({
            success: true,
            data: inclusions
        });
    } catch (error) {
        logger.vendor("error", "Failed to search inclusions", {
            error: error.message,
            searchTerm: req.query.search,
            vendorId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to search inclusions",
            error: error.message
        });
    }
};

// Create new inclusion
exports.createInclusion = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || name.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Inclusion name is required"
            });
        }

        // Check if inclusion already exists (case-insensitive)
        const existingInclusion = await Inclusion.findOne({
            where: {
                name: { [require('sequelize').Op.like]: name.trim() },
                is_active: true
            }
        });

        if (existingInclusion) {
            // Return existing inclusion instead of error
            logger.vendor("info", "Inclusion already exists, returning existing", {
                inclusionId: existingInclusion.id,
                inclusionName: existingInclusion.name,
                vendorId: req.user?.id
            });

            return res.status(200).json({
                success: true,
                message: "Inclusion already exists",
                data: existingInclusion,
                isExisting: true
            });
        }

        const inclusion = await Inclusion.create({
            name: name.trim(),
            description: description?.trim() || null,
            usage_count: 0
        });

        logger.vendor("info", "Created new inclusion", {
            inclusionId: inclusion.id,
            inclusionName: inclusion.name,
            vendorId: req.user?.id
        });

        res.status(201).json({
            success: true,
            message: "Inclusion created successfully",
            data: inclusion
        });
    } catch (error) {
        logger.vendor("error", "Failed to create inclusion", {
            error: error.message,
            vendorId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to create inclusion",
            error: error.message
        });
    }
};

// Get inclusion by ID
exports.getInclusionById = async (req, res) => {
    try {
        const { id } = req.params;

        const inclusion = await Inclusion.findOne({
            where: {
                id,
                is_active: true
            }
        });

        if (!inclusion) {
            return res.status(404).json({
                success: false,
                message: "Inclusion not found"
            });
        }

        res.json({
            success: true,
            data: inclusion
        });
    } catch (error) {
        logger.vendor("error", "Failed to retrieve inclusion", {
            error: error.message,
            inclusionId: req.params.id,
            vendorId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to retrieve inclusion",
            error: error.message
        });
    }
};

// Update inclusion
exports.updateInclusion = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        const inclusion = await Inclusion.findOne({
            where: {
                id,
                is_active: true
            }
        });

        if (!inclusion) {
            return res.status(404).json({
                success: false,
                message: "Inclusion not found"
            });
        }

        // Check if new name conflicts with existing inclusion
        if (name && name.trim() !== inclusion.name) {
            const existingInclusion = await Inclusion.findOne({
                where: {
                    name: name.trim(),
                    is_active: true,
                    id: { [require('sequelize').Op.ne]: id }
                }
            });

            if (existingInclusion) {
                return res.status(400).json({
                    success: false,
                    message: "Inclusion with this name already exists"
                });
            }
        }

        await inclusion.update({
            name: name?.trim() || inclusion.name,
            description: description?.trim() || inclusion.description
        });

        logger.vendor("info", "Updated inclusion", {
            inclusionId: inclusion.id,
            inclusionName: inclusion.name,
            vendorId: req.user?.id
        });

        res.json({
            success: true,
            message: "Inclusion updated successfully",
            data: inclusion
        });
    } catch (error) {
        logger.vendor("error", "Failed to update inclusion", {
            error: error.message,
            inclusionId: req.params.id,
            vendorId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to update inclusion",
            error: error.message
        });
    }
};

// Delete inclusion (soft delete)
exports.deleteInclusion = async (req, res) => {
    try {
        const { id } = req.params;

        const inclusion = await Inclusion.findOne({
            where: {
                id,
                is_active: true
            }
        });

        if (!inclusion) {
            return res.status(404).json({
                success: false,
                message: "Inclusion not found"
            });
        }

        await inclusion.update({ is_active: false });

        logger.vendor("info", "Deleted inclusion", {
            inclusionId: inclusion.id,
            inclusionName: inclusion.name,
            vendorId: req.user?.id
        });

        res.json({
            success: true,
            message: "Inclusion deleted successfully"
        });
    } catch (error) {
        logger.vendor("error", "Failed to delete inclusion", {
            error: error.message,
            inclusionId: req.params.id,
            vendorId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to delete inclusion",
            error: error.message
        });
    }
}; 