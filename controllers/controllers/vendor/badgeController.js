const { Badge, Trek } = require("../../models");
const logger = require("../../utils/logger");

// GET /api/vendor/badges
// Returns all active badges — read-only reference list for vendors
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
        logger.error("Error fetching badges for vendor:", error);
        res.status(500).json({ success: false, error: "Failed to fetch badges" });
    }
};

// GET /api/vendor/badges/trek/:trekId
// Returns the active badge for a specific trek owned by the authenticated vendor
const getTrekBadge = async (req, res) => {
    try {
        const { trekId } = req.params;
        const vendorId = req.vendor.id;

        // Verify the trek belongs to this vendor
        const trek = await Trek.findOne({
            where: { id: trekId, vendor_id: vendorId },
            attributes: ['id', 'badge_id'],
        });

        if (!trek) {
            return res.status(404).json({ success: false, error: "Trek not found or does not belong to your account" });
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
        logger.error("Error fetching trek badge for vendor:", error);
        res.status(500).json({ success: false, error: "Failed to fetch trek badge" });
    }
};

// GET /api/vendor/badges/my-treks
// Returns all badges assigned to any of the authenticated vendor's treks
const getMyTrekBadges = async (req, res) => {
    try {
        const vendorId = req.vendor.id;

        const treks = await Trek.findAll({
            where: { vendor_id: vendorId },
            attributes: ['id', 'title', 'badge_id'],
            include: [{
                model: Badge,
                as: 'badge',
                attributes: ['id', 'name', 'description', 'icon', 'color', 'category', 'styling'],
                where: { is_active: true },
                required: false,
            }],
        });

        // Only return treks that have a badge assigned
        const trekBadges = treks
            .filter(t => t.badge)
            .map(t => ({
                trek_id: t.id,
                trek_title: t.title,
                badge: t.badge,
            }));

        res.json({ success: true, data: trekBadges });
    } catch (error) {
        logger.error("Error fetching vendor trek badges:", error);
        res.status(500).json({ success: false, error: "Failed to fetch trek badges" });
    }
};

module.exports = { getAllBadges, getTrekBadge, getMyTrekBadges };
