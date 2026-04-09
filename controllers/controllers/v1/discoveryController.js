const { DiscoveryContent, TrekForecast, HomeTheme, Trek } = require("../../models");
const { Op } = require("sequelize");
const logger = require("../../utils/logger");

/**
 * GET /api/v1/discovery
 *
 * Returns a single aggregated payload of all active discovery content for the
 * mobile home feed. Only returns records with PUBLISHED or ACTIVE status that
 * fall within their configured date windows.
 */
const getDiscovery = async (req, res) => {
    try {
        const now = new Date();

        const activeStatuses = { [Op.in]: ['active', 'PUBLISHED', 'ACTIVE'] };

        const [discoveryContent, forecasts, themes] = await Promise.all([
            DiscoveryContent.findAll({
                where: {
                    status: activeStatuses,
                },
                include: [
                    {
                        model: Trek,
                        as: 'trek',
                        attributes: ['id', 'title', 'duration_days', 'difficulty', 'price'],
                        required: false,
                    },
                ],
                order: [['priority', 'DESC'], ['created_at', 'DESC']],
            }),

            TrekForecast.findAll({
                where: {
                    status: activeStatuses,
                    [Op.and]: [
                        {
                            [Op.or]: [
                                { valid_from: null },
                                { valid_from: { [Op.lte]: now } },
                            ],
                        },
                        {
                            [Op.or]: [
                                { valid_to: null },
                                { valid_to: { [Op.gte]: now } },
                            ],
                        },
                    ],
                },
                order: [['created_at', 'DESC']],
            }),

            HomeTheme.findAll({
                where: {
                    status: activeStatuses,
                    [Op.and]: [
                        {
                            [Op.or]: [
                                { start_date: null },
                                { start_date: { [Op.lte]: now } },
                            ],
                        },
                        {
                            [Op.or]: [
                                { end_date: null },
                                { end_date: { [Op.gte]: now } },
                            ],
                        },
                    ],
                },
                order: [['display_order', 'DESC'], ['created_at', 'DESC']],
            }),
        ]);

        res.json({
            success: true,
            data: {
                discovery_content: discoveryContent,
                forecasts,
                themes,
            },
        });
    } catch (error) {
        logger.error("Error fetching discovery data:", error);
        res.status(500).json({ success: false, error: "Failed to fetch discovery data" });
    }
};

module.exports = { getDiscovery };
