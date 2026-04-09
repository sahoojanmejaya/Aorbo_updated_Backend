const { Badge, Trek } = require("../../models");
const logger = require("../../utils/logger");

// GET /api/v1/badges
// Public — returns all active badges, optionally filtered by category
const getAllBadges = async (req, res) => {
    try {
        const { category } = req.query;
        const where = { is_active: true };
        if (category) where.category = category;

        const badges = await Badge.findAll({
            where,
            attributes: ['id', 'name', 'description', 'icon', 'color', 'category', 'styling', 'sort_order'],
            order: [
                ['sort_order', 'ASC'],
                ['name', 'ASC'],
            ],
        });

        res.json({ success: true, data: badges });
    } catch (error) {
        logger.error("Error fetching badges:", error);
        res.status(500).json({ success: false, error: "Failed to fetch badges" });
    }
};

// GET /api/v1/badges/categories
// Public — returns the available badge category values
const getBadgeCategories = async (req, res) => {
    res.json({
        success: true,
        data: ['achievement', 'difficulty', 'special', 'seasonal', 'certification'],
    });
};

// GET /api/v1/badges/trek/:trekId
// Public — returns the active badge assigned to the given trek, or null
const getTrekBadge = async (req, res) => {
    try {
        const { trekId } = req.params;

        const trek = await Trek.findByPk(trekId, {
            attributes: ['id', 'badge_id'],
        });

        if (!trek) {
            return res.status(404).json({ success: false, error: "Trek not found" });
        }

        if (!trek.badge_id) {
            return res.json({ success: true, data: null });
        }

        const badge = await Badge.findOne({
            where: { id: trek.badge_id, is_active: true },
            attributes: ['id', 'name', 'description', 'icon', 'color', 'category', 'styling', 'sort_order'],
        });

        res.json({ success: true, data: badge || null });
    } catch (error) {
        logger.error("Error fetching trek badge:", error);
        res.status(500).json({ success: false, error: "Failed to fetch trek badge" });
    }
};

module.exports = { getAllBadges, getBadgeCategories, getTrekBadge };
