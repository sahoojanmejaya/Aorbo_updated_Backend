const { DiscoveryContent } = require("../../models");
const { Op } = require("sequelize");
const logger = require('../../utils/logger');

// Get all discovery content
const getAllContent = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            category,
            status,
            search,
            sort_by = "priority",
            sort_order = "DESC"
        } = req.query;

        const allowedSortColumns = ['created_at', 'updated_at', 'priority', 'title'];
        const safeSortBy = allowedSortColumns.includes(sort_by) ? sort_by : 'priority';
        const safeSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const offset = (page - 1) * limit;
        const whereClause = {};

        if (category) {
            whereClause.category = category;
        }

        if (status) {
            whereClause.status = status;
        }

        if (search) {
            whereClause[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows: content } = await DiscoveryContent.findAndCountAll({
            where: whereClause,
            // Temporarily remove Trek association to fix 500 error
            include: [
                {
                    model: require('../../models').Trek,
                    as: 'trek',
                    attributes: ['id', 'title', 'status', 'base_price']
                }
            ],
            order: [[safeSortBy, safeSortOrder]],
            limit: Number.parseInt(limit),
            offset: Number.parseInt(offset)
        });

        res.json({
            success: true,
            data: content,
            pagination: {
                current_page: Number.parseInt(page),
                total_pages: Math.ceil(count / limit),
                total_items: count,
                items_per_page: Number.parseInt(limit)
            }
        });

    } catch (error) {
        logger.error("Error fetching discovery content:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch discovery content",
            details: error.message
        });
    }
};

// Get single content by ID
const getContentById = async (req, res) => {
    try {
        const { id } = req.params;

        const content = await DiscoveryContent.findByPk(id, {
            include: [
                {
                    model: require('../../models').Trek,
                    as: 'trek',
                    attributes: ['id', 'title', 'status', 'base_price']
                }
            ]
        });

        if (!content) {
            return res.status(404).json({
                success: false,
                error: "Content not found"
            });
        }

        res.json({
            success: true,
            data: content
        });

    } catch (error) {
        logger.error("Error fetching content:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch content",
            details: error.message
        });
    }
};

// Create new content
const createContent = async (req, res) => {
    try {
        const {
            category, title, subtitle, description, image_url, video_url,
            trek_id, status, priority, published_at, expires_at, metadata
        } = req.body;

        const content = await DiscoveryContent.create({
            category, title, subtitle, description, image_url, video_url,
            trek_id, status, priority, published_at, expires_at, metadata
        });

        res.status(201).json({
            success: true,
            message: "Discovery content created successfully",
            data: content
        });

    } catch (error) {
        logger.error("Error creating content:", error);
        res.status(500).json({
            success: false,
            error: "Failed to create content",
            details: error.message
        });
    }
};

// Update content
const updateContent = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            category, title, subtitle, description, image_url, video_url,
            trek_id, status, priority, published_at, expires_at, metadata
        } = req.body;

        const content = await DiscoveryContent.findByPk(id);
        if (!content) {
            return res.status(404).json({
                success: false,
                error: "Content not found"
            });
        }

        const updateData = {};
        if (category !== undefined) updateData.category = category;
        if (title !== undefined) updateData.title = title;
        if (subtitle !== undefined) updateData.subtitle = subtitle;
        if (description !== undefined) updateData.description = description;
        if (image_url !== undefined) updateData.image_url = image_url;
        if (video_url !== undefined) updateData.video_url = video_url;
        if (trek_id !== undefined) updateData.trek_id = trek_id;
        if (status !== undefined) updateData.status = status;
        if (priority !== undefined) updateData.priority = priority;
        if (published_at !== undefined) updateData.published_at = published_at;
        if (expires_at !== undefined) updateData.expires_at = expires_at;
        if (metadata !== undefined) updateData.metadata = metadata;

        await content.update(updateData);

        res.json({
            success: true,
            message: "Content updated successfully",
            data: content
        });

    } catch (error) {
        logger.error("Error updating content:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update content",
            details: error.message
        });
    }
};

// Delete content
const deleteContent = async (req, res) => {
    try {
        const { id } = req.params;

        const content = await DiscoveryContent.findByPk(id);
        if (!content) {
            return res.status(404).json({
                success: false,
                error: "Content not found"
            });
        }

        await content.destroy();

        res.json({
            success: true,
            message: "Content deleted successfully"
        });

    } catch (error) {
        logger.error("Error deleting content:", error);
        res.status(500).json({
            success: false,
            error: "Failed to delete content",
            details: error.message
        });
    }
};

module.exports = {
    getAllContent,
    getContentById,
    createContent,
    updateContent,
    deleteContent
};
