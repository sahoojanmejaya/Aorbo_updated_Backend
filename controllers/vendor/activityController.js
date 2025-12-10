const { Activity } = require("../../models");
const { Op } = require("sequelize");
const logger = require("../../utils/logger");

// Get all activities (popular ones first)
exports.getAllActivities = async (req, res) => {
    try {
        const { search, category } = req.query;

        let whereClause = { is_active: true };

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

        const activities = await Activity.findAll({
            where: whereClause,
            attributes: ["id", "name", "category_name"],
            order: [["name", "ASC"]],
            limit: 10
        });

        logger.vendor("info", "Retrieved all activities", {
            count: activities.length,
            vendorId: req.user?.id
        });

        res.json({
            success: true,
            data: activities,
        });
    } catch (err) {
        logger.vendor("error", "Failed to retrieve activities", {
            error: err.message,
            vendorId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to fetch activities",
        });
    }
};

// Search activities
exports.searchActivities = async (req, res) => {
    try {
        const { search } = req.query;
        
        if (!search || search.trim() === "") {
            return res.json({
                success: true,
                data: []
            });
        }

        const searchTerm = search.trim();
        
        const activities = await Activity.findAll({
            where: {
                is_active: true,
                name: {
                    [Op.like]: `%${searchTerm}%`
                }
            },
            attributes: ["id", "name", "category_name"],
            order: [["name", "ASC"]],
            limit: 10
        });

        logger.vendor("info", "Searched activities", {
            searchTerm,
            count: activities.length,
            vendorId: req.user?.id
        });

        res.json({
            success: true,
            data: activities
        });
    } catch (error) {
        logger.vendor("error", "Failed to search activities", {
            error: error.message,
            searchTerm: req.query.search,
            vendorId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to search activities",
            error: error.message
        });
    }
};

// Create new activity
exports.createActivity = async (req, res) => {
    try {
        const { name, category_name } = req.body;

        if (!name || name.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Activity name is required"
            });
        }

        if (!category_name || category_name.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Activity category is required"
            });
        }

        // Check if activity already exists
        const existingActivity = await Activity.findOne({
            where: {
                name: name.trim(),
                is_active: true
            }
        });

        if (existingActivity) {
            return res.status(400).json({
                success: false,
                message: "Activity with this name already exists"
            });
        }

        // Check if category exists, if not, it will be created automatically
        // since we're creating an activity with that category
        const trimmedCategoryName = category_name.trim();
        const trimmedActivityName = name.trim();

        const activity = await Activity.create({
            name: trimmedActivityName,
            category_name: trimmedCategoryName,
            is_active: true
        });

        logger.vendor("info", "Created new activity", {
            activityId: activity.id,
            activityName: activity.name,
            categoryName: activity.category_name,
            vendorId: req.user?.id
        });

        res.status(201).json({
            success: true,
            message: "Activity created successfully",
            data: activity
        });
    } catch (error) {
        logger.vendor("error", "Failed to create activity", {
            error: error.message,
            vendorId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to create activity",
            error: error.message
        });
    }
};

// Get activity categories
exports.getCategories = async (req, res) => {
    try {
        const categories = await Activity.findAll({
            where: { is_active: true },
            attributes: ["category_name"],
            group: ["category_name"],
            order: [["category_name", "ASC"]],
        });

        const categoryList = categories.map((cat) => cat.category_name);

        logger.vendor("info", "Retrieved activity categories", {
            count: categoryList.length,
            vendorId: req.user?.id
        });

        res.json({
            success: true,
            data: categoryList,
        });
    } catch (err) {
        logger.vendor("error", "Failed to retrieve activity categories", {
            error: err.message,
            vendorId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to fetch categories",
        });
    }
};

// Create new activity category
exports.createCategory = async (req, res) => {
    try {
        const { category_name } = req.body;

        if (!category_name || category_name.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Category name is required"
            });
        }

        const trimmedCategoryName = category_name.trim();

        // Check if category already exists
        const existingCategory = await Activity.findOne({
            where: {
                category_name: trimmedCategoryName,
                is_active: true
            }
        });

        if (existingCategory) {
            return res.status(400).json({
                success: false,
                message: "Category with this name already exists"
            });
        }

        // Create a placeholder activity with this category to establish the category
        const placeholderActivity = await Activity.create({
            name: `${trimmedCategoryName} Activity`,
            category_name: trimmedCategoryName,
            is_active: true
        });

        logger.vendor("info", "Created new activity category", {
            categoryName: trimmedCategoryName,
            vendorId: req.user?.id
        });

        res.status(201).json({
            success: true,
            message: "Category created successfully",
            data: {
                category_name: trimmedCategoryName
            }
        });
    } catch (error) {
        logger.vendor("error", "Failed to create activity category", {
            error: error.message,
            vendorId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to create category",
            error: error.message
        });
    }
};
