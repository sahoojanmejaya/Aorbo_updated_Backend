const { Badge, Trek } = require("../../models");
const { Op } = require("sequelize");

// Get all badges with pagination and filtering
exports.getAllBadges = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, category, is_active } = req.query;
        const offset = (page - 1) * limit;

        // Build where clause
        const whereClause = {};

        if (search) {
            whereClause[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } },
            ];
        }

        if (category) {
            whereClause.category = category;
        }

        if (is_active !== undefined) {
            whereClause.is_active = is_active === "true";
        }

        const { count, rows: badges } = await Badge.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Trek,
                    as: "treks",
                    attributes: ["id", "title"],
                    where: { status: "active" },
                    required: false,
                },
            ],
            order: [
                ["sort_order", "ASC"],
                ["name", "ASC"],
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
        });

        // Count treks for each badge
        const badgesWithCounts = badges.map((badge) => {
            const badgeData = badge.toJSON();
            badgeData.trek_count = badgeData.treks ? badgeData.treks.length : 0;
            delete badgeData.treks; // Remove trek details from response
            return badgeData;
        });

        res.json({
            success: true,
            data: badgesWithCounts,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / limit),
                totalCount: count,
            },
        });
    } catch (error) {
        console.error("Error fetching badges:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch badges",
            error: error.message,
        });
    }
};

// Get badge by ID
exports.getBadgeById = async (req, res) => {
    try {
        const { id } = req.params;

        const badge = await Badge.findByPk(id, {
            include: [
                {
                    model: Trek,
                    as: "treks",
                    attributes: ["id", "title", "status", "created_at"],
                    order: [["created_at", "DESC"]],
                },
            ],
        });

        if (!badge) {
            return res.status(404).json({
                success: false,
                message: "Badge not found",
            });
        }

        res.json({
            success: true,
            data: badge,
        });
    } catch (error) {
        console.error("Error fetching badge:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch badge",
            error: error.message,
        });
    }
};

// Create new badge
exports.createBadge = async (req, res) => {
    try {
        const {
            name,
            description,
            icon,
            color,
            category,
            criteria,
            is_active = true,
            sort_order = 0,
        } = req.body;

        // Validate required fields
        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Badge name is required",
            });
        }

        // Check if badge name already exists
        const existingBadge = await Badge.findOne({
            where: { name: name.trim() },
        });

        if (existingBadge) {
            return res.status(400).json({
                success: false,
                message: "Badge with this name already exists",
            });
        }

        const badge = await Badge.create({
            name: name.trim(),
            description,
            icon,
            color,
            category,
            criteria,
            is_active,
            sort_order,
        });

        res.status(201).json({
            success: true,
            message: "Badge created successfully",
            data: badge,
        });
    } catch (error) {
        console.error("Error creating badge:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create badge",
            error: error.message,
        });
    }
};

// Update badge
exports.updateBadge = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            description,
            icon,
            color,
            category,
            criteria,
            is_active,
            sort_order,
        } = req.body;

        const badge = await Badge.findByPk(id);

        if (!badge) {
            return res.status(404).json({
                success: false,
                message: "Badge not found",
            });
        }

        // Check if name is being changed and if it already exists
        if (name && name.trim() !== badge.name) {
            const existingBadge = await Badge.findOne({
                where: {
                    name: name.trim(),
                    id: { [Op.ne]: id },
                },
            });

            if (existingBadge) {
                return res.status(400).json({
                    success: false,
                    message: "Badge with this name already exists",
                });
            }
        }

        // Update badge
        await badge.update({
            name: name ? name.trim() : badge.name,
            description:
                description !== undefined ? description : badge.description,
            icon: icon !== undefined ? icon : badge.icon,
            color: color !== undefined ? color : badge.color,
            category: category || badge.category,
            criteria: criteria !== undefined ? criteria : badge.criteria,
            is_active: is_active !== undefined ? is_active : badge.is_active,
            sort_order:
                sort_order !== undefined ? sort_order : badge.sort_order,
        });

        res.json({
            success: true,
            message: "Badge updated successfully",
            data: badge,
        });
    } catch (error) {
        console.error("Error updating badge:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update badge",
            error: error.message,
        });
    }
};

// Delete badge
exports.deleteBadge = async (req, res) => {
    try {
        const { id } = req.params;

        const badge = await Badge.findByPk(id, {
            include: [
                {
                    model: Trek,
                    as: "treks",
                    attributes: ["id", "title"],
                },
            ],
        });

        if (!badge) {
            return res.status(404).json({
                success: false,
                message: "Badge not found",
            });
        }

        // Check if badge is associated with any treks
        if (badge.treks && badge.treks.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete badge that is associated with treks",
                data: {
                    associated_treks: badge.treks.map((trek) => ({
                        id: trek.id,
                        title: trek.title,
                    })),
                },
            });
        }

        await badge.destroy();

        res.json({
            success: true,
            message: "Badge deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting badge:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete badge",
            error: error.message,
        });
    }
};

// Get badge categories
exports.getBadgeCategories = async (req, res) => {
    try {
        const categories = [
            { value: "achievement", label: "Achievement" },
            { value: "difficulty", label: "Difficulty" },
            { value: "special", label: "Special" },
            { value: "seasonal", label: "Seasonal" },
            { value: "certification", label: "Certification" },
        ];

        res.json({
            success: true,
            data: categories,
        });
    } catch (error) {
        console.error("Error fetching badge categories:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch badge categories",
            error: error.message,
        });
    }
};

// Bulk update badge sort order
exports.updateBadgeSortOrder = async (req, res) => {
    try {
        const { badges } = req.body;

        if (!Array.isArray(badges)) {
            return res.status(400).json({
                success: false,
                message: "Badges array is required",
            });
        }

        // Update sort order for each badge
        const updatePromises = badges.map(({ id, sort_order }) => {
            return Badge.update({ sort_order }, { where: { id } });
        });

        await Promise.all(updatePromises);

        res.json({
            success: true,
            message: "Badge sort order updated successfully",
        });
    } catch (error) {
        console.error("Error updating badge sort order:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update badge sort order",
            error: error.message,
        });
    }
};
