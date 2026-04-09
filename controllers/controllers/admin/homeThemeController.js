const { HomeTheme } = require("../../models");
const { Op } = require("sequelize");
const logger = require('../../utils/logger');

// Get all home themes
const getAllThemes = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            type,
            status,
            search,
            sort_by = "display_order",
            sort_order = "DESC"
        } = req.query;

        const allowedSortColumns = ['created_at', 'updated_at', 'display_order', 'start_date', 'end_date', 'title'];
        const safeSortBy = allowedSortColumns.includes(sort_by) ? sort_by : 'display_order';
        const safeSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const offset = (page - 1) * limit;
        const whereClause = {};

        if (type) {
            whereClause.type = type;
        }

        if (status) {
            whereClause.status = status;
        }

        if (search) {
            whereClause[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { subtitle: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows: themes } = await HomeTheme.findAndCountAll({
            where: whereClause,
            order: [[safeSortBy, safeSortOrder]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: themes,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(count / limit),
                total_items: count,
                items_per_page: parseInt(limit)
            }
        });

    } catch (error) {
        logger.error("Error fetching home themes:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch home themes",
            details: error.message
        });
    }
};

// Get single theme by ID
const getThemeById = async (req, res) => {
    try {
        const { id } = req.params;

        const theme = await HomeTheme.findByPk(id);

        if (!theme) {
            return res.status(404).json({
                success: false,
                error: "Theme not found"
            });
        }

        res.json({
            success: true,
            data: theme
        });

    } catch (error) {
        logger.error("Error fetching theme:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch theme",
            details: error.message
        });
    }
};

// Create new theme
const createTheme = async (req, res) => {
    try {
        const {
            title, subtitle, description, type, status,
            background_image, background_color, text_color,
            start_date, end_date, display_order, trek_ids
        } = req.body;

        const theme = await HomeTheme.create({
            title, subtitle, description, type, status,
            background_image, background_color, text_color,
            start_date, end_date, 
            display_order: display_order !== undefined ? display_order : (req.body.priority || 0),
            trek_ids: trek_ids ? JSON.stringify(trek_ids) : null,
        });

        res.status(201).json({
            success: true,
            message: "Home theme created successfully",
            data: theme
        });

    } catch (error) {
        logger.error("Error creating theme:", error);
        res.status(500).json({
            success: false,
            error: "Failed to create theme",
            details: error.message
        });
    }
};

// Update theme
const updateTheme = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title, subtitle, description, type, status,
            background_image, background_color, text_color,
            start_date, end_date, display_order, trek_ids
        } = req.body;

        const theme = await HomeTheme.findByPk(id);
        if (!theme) {
            return res.status(404).json({
                success: false,
                error: "Theme not found"
            });
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (subtitle !== undefined) updateData.subtitle = subtitle;
        if (description !== undefined) updateData.description = description;
        if (type !== undefined) updateData.type = type;
        if (status !== undefined) updateData.status = status;
        if (background_image !== undefined) updateData.background_image = background_image;
        if (background_color !== undefined) updateData.background_color = background_color;
        if (text_color !== undefined) updateData.text_color = text_color;
        if (start_date !== undefined) updateData.start_date = start_date;
        if (end_date !== undefined) updateData.end_date = end_date;
        
        // Handle priority (frontend) vs display_order (backend)
        const resolvedOrder = display_order !== undefined ? display_order : (req.body.priority !== undefined ? req.body.priority : undefined);
        if (resolvedOrder !== undefined) updateData.display_order = resolvedOrder;
        
        if (trek_ids !== undefined) updateData.trek_ids = Array.isArray(trek_ids) ? JSON.stringify(trek_ids) : trek_ids;

        await theme.update(updateData);

        res.json({
            success: true,
            message: "Theme updated successfully",
            data: theme
        });

    } catch (error) {
        logger.error("Error updating theme:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update theme",
            details: error.message
        });
    }
};

// Delete theme
const deleteTheme = async (req, res) => {
    try {
        const { id } = req.params;

        const theme = await HomeTheme.findByPk(id);
        if (!theme) {
            return res.status(404).json({
                success: false,
                error: "Theme not found"
            });
        }

        await theme.destroy();

        res.json({
            success: true,
            message: "Theme deleted successfully"
        });

    } catch (error) {
        logger.error("Error deleting theme:", error);
        res.status(500).json({
            success: false,
            error: "Failed to delete theme",
            details: error.message
        });
    }
};

module.exports = {
    getAllThemes,
    getThemeById,
    createTheme,
    updateTheme,
    deleteTheme
};
