const { Activity, sequelize } = require("../../models");
const { Op } = require("sequelize");

// Get all activities
exports.getAllActivities = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, category, status } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = {};

        // Search by name
        if (search) {
            whereClause.name = {
                [Op.like]: `%${search}%`,
            };
        }

        // Filter by category
        if (category) {
            whereClause.category_name = category;
        }

        // Filter by status
        if (status !== undefined) {
            whereClause.is_active = status === "true";
        }

        const activities = await Activity.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [["created_at", "DESC"]],
        });

        res.json({
            success: true,
            data: activities.rows,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(activities.count / limit),
                totalItems: activities.count,
                itemsPerPage: parseInt(limit),
            },
        });
    } catch (err) {
        console.error("Error fetching activities:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch activities",
        });
    }
};

// Get activity by ID
exports.getActivityById = async (req, res) => {
    try {
        const activity = await Activity.findByPk(req.params.id);
        if (!activity) {
            return res.status(404).json({
                success: false,
                message: "Activity not found",
            });
        }
        res.json({ success: true, data: activity });
    } catch (err) {
        console.error("Error fetching activity:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch activity",
        });
    }
};

// Create new activity
exports.createActivity = async (req, res) => {
    try {
        const { name, category_name, is_active = true } = req.body;

        // Validate required fields
        if (!name || !category_name) {
            return res.status(400).json({
                success: false,
                message: "Name and category_name are required",
            });
        }

        // Check if activity with same name already exists
        const existingActivity = await Activity.findOne({
            where: { name: name },
        });

        if (existingActivity) {
            return res.status(400).json({
                success: false,
                message: "Activity with this name already exists",
            });
        }

        const activity = await Activity.create({
            name,
            category_name,
            is_active,
        });

        res.status(201).json({
            success: true,
            message: "Activity created successfully",
            data: activity,
        });
    } catch (err) {
        console.error("Error creating activity:", err);
        res.status(500).json({
            success: false,
            message: "Failed to create activity",
        });
    }
};

// Update activity
exports.updateActivity = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category_name, is_active } = req.body;

        const activity = await Activity.findByPk(id);
        if (!activity) {
            return res.status(404).json({
                success: false,
                message: "Activity not found",
            });
        }

        // Check if name is being changed and if it conflicts with existing activity
        if (name && name !== activity.name) {
            const existingActivity = await Activity.findOne({
                where: {
                    name: name,
                    id: { [Op.ne]: id },
                },
            });

            if (existingActivity) {
                return res.status(400).json({
                    success: false,
                    message: "Activity with this name already exists",
                });
            }
        }

        // Update fields
        if (name !== undefined) activity.name = name;
        if (category_name !== undefined) activity.category_name = category_name;
        if (is_active !== undefined) activity.is_active = is_active;

        await activity.save();

        res.json({
            success: true,
            message: "Activity updated successfully",
            data: activity,
        });
    } catch (err) {
        console.error("Error updating activity:", err);
        res.status(500).json({
            success: false,
            message: "Failed to update activity",
        });
    }
};

// Delete activity
exports.deleteActivity = async (req, res) => {
    try {
        const { id } = req.params;

        const activity = await Activity.findByPk(id);
        if (!activity) {
            return res.status(404).json({
                success: false,
                message: "Activity not found",
            });
        }

        await activity.destroy();

        res.json({
            success: true,
            message: "Activity deleted successfully",
        });
    } catch (err) {
        console.error("Error deleting activity:", err);
        res.status(500).json({
            success: false,
            message: "Failed to delete activity",
        });
    }
};

// Get all categories (for dropdown)
exports.getCategories = async (req, res) => {
    try {
        const categories = await Activity.findAll({
            attributes: [
                [
                    sequelize.fn("DISTINCT", sequelize.col("category_name")),
                    "category_name",
                ],
            ],
            raw: true,
        });

        const categoryList = categories.map((cat) => cat.category_name);

        res.json({
            success: true,
            data: categoryList,
        });
    } catch (err) {
        console.error("Error fetching categories:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch categories",
        });
    }
};

// Toggle activity status
exports.toggleActivityStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const activity = await Activity.findByPk(id);
        if (!activity) {
            return res.status(404).json({
                success: false,
                message: "Activity not found",
            });
        }

        activity.is_active = !activity.is_active;
        await activity.save();

        res.json({
            success: true,
            message: `Activity ${
                activity.is_active ? "activated" : "deactivated"
            } successfully`,
            data: activity,
        });
    } catch (err) {
        console.error("Error toggling activity status:", err);
        res.status(500).json({
            success: false,
            message: "Failed to toggle activity status",
        });
    }
};

// Search activities for autocomplete
exports.searchActivities = async (req, res) => {
    try {
        const { q: searchTerm, limit = 10 } = req.query;

        if (!searchTerm || searchTerm.length < 2) {
            return res.json({
                success: true,
                data: [],
            });
        }

        const activities = await Activity.findAll({
            where: {
                name: {
                    [Op.like]: `%${searchTerm}%`,
                },
            },
            attributes: ["id", "name", "category_name"],
            limit: parseInt(limit),
            order: [["name", "ASC"]],
        });

        res.json({
            success: true,
            data: activities,
        });
    } catch (err) {
        console.error("Error searching activities:", err);
        res.status(500).json({
            success: false,
            message: "Failed to search activities",
        });
    }
};

// Search categories for autocomplete
exports.searchCategories = async (req, res) => {
    try {
        const { q: searchTerm, limit = 10 } = req.query;

        if (!searchTerm || searchTerm.length < 2) {
            return res.json({
                success: true,
                data: [],
            });
        }

        const categories = await Activity.findAll({
            where: {
                category_name: {
                    [Op.like]: `%${searchTerm}%`,
                },
            },
            attributes: [
                [
                    sequelize.fn("DISTINCT", sequelize.col("category_name")),
                    "category_name",
                ],
            ],
            limit: parseInt(limit),
            order: [["category_name", "ASC"]],
            raw: true,
        });

        const categoryList = categories.map((cat) => cat.category_name);

        res.json({
            success: true,
            data: categoryList,
        });
    } catch (err) {
        console.error("Error searching categories:", err);
        res.status(500).json({
            success: false,
            message: "Failed to search categories",
        });
    }
};
