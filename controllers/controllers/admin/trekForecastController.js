const { TrekForecast } = require("../../models");
const { Op } = require("sequelize");
const logger = require("../../utils/logger");

/**
 * Build a safe data object from request body, applying field allowlist and
 * bundling UI style configs (containerStyle, imageDimensions, textStyles) into
 * the metadata JSON field. Accepts both camelCase (from frontend) and snake_case
 * forms for image fields.
 */
function buildForecastData(body) {
    const {
        season, title, description,
        recommended_treks, weather_info, tips,
        status, valid_from, valid_to,
        destination, region,
        // Accept camelCase (frontend) and snake_case forms
        forecastImage, forecast_image,
        iconImage, icon_image,
        seasonIcon, season_icon,
        metadata,
        // Style fields to bundle into metadata
        containerStyle, imageDimensions, textStyles,
        display_order, priority
    } = body;

    const data = {};

    if (season !== undefined) data.season = season;
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (recommended_treks !== undefined) data.recommended_treks = recommended_treks;
    if (weather_info !== undefined) data.weather_info = weather_info;
    if (tips !== undefined) data.tips = tips;
    if (status !== undefined) data.status = status;
    if (valid_from !== undefined) data.valid_from = valid_from;
    if (valid_to !== undefined) data.valid_to = valid_to;
    if (destination !== undefined) data.destination = destination;
    if (region !== undefined) data.region = region;

    const resolvedForecastImage = forecastImage ?? forecast_image;
    const resolvedIconImage = iconImage ?? icon_image;
    const resolvedSeasonIcon = seasonIcon ?? season_icon;

    if (resolvedForecastImage !== undefined) data.forecast_image = resolvedForecastImage;
    if (resolvedIconImage !== undefined) data.icon_image = resolvedIconImage;
    if (resolvedSeasonIcon !== undefined) data.season_icon = resolvedSeasonIcon;

    // Bundle style configs into metadata; merge with any top-level metadata passed
    const baseMetadata = metadata && typeof metadata === 'object' ? metadata : {};
    const styleOverrides = {};
    if (containerStyle !== undefined) styleOverrides.containerStyle = containerStyle;
    if (imageDimensions !== undefined) styleOverrides.imageDimensions = imageDimensions;
    if (textStyles !== undefined) styleOverrides.textStyles = textStyles;

    if (metadata !== undefined || Object.keys(styleOverrides).length > 0) {
        data.metadata = { ...baseMetadata, ...styleOverrides };
    }

    const resolvedOrder = display_order !== undefined ? display_order : priority;
    if (resolvedOrder !== undefined) data.display_order = resolvedOrder;

    return data;
}

// Get all trek forecasts
const getAllForecasts = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            season,
            status,
            search,
            sort_by = "created_at",
            sort_order = "DESC"
        } = req.query;

        const allowedSortColumns = ['created_at', 'updated_at', 'season', 'valid_from', 'valid_to', 'display_order'];
        const safeSortBy = allowedSortColumns.includes(sort_by) ? sort_by : 'display_order';
        const safeSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const offset = (Number.parseInt(page) - 1) * Number.parseInt(limit);
        const whereClause = {};

        if (season) whereClause.season = season;
        if (status) whereClause.status = status;
        if (search) {
            whereClause[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } },
                { destination: { [Op.like]: `%${search}%` } },
                { region: { [Op.like]: `%${search}%` } },
            ];
        }

        const { count, rows: forecasts } = await TrekForecast.findAndCountAll({
            where: whereClause,
            order: [[safeSortBy, safeSortOrder]],
            limit: Number.parseInt(limit),
            offset,
        });

        res.json({
            success: true,
            data: forecasts,
            pagination: {
                current_page: Number.parseInt(page),
                total_pages: Math.ceil(count / Number.parseInt(limit)),
                total_items: count,
                items_per_page: Number.parseInt(limit),
            },
        });
    } catch (error) {
        logger.error("Error fetching trek forecasts:", error);
        res.status(500).json({ success: false, error: "Failed to fetch trek forecasts" });
    }
};

// Get single forecast by ID
const getForecastById = async (req, res) => {
    try {
        const { id } = req.params;
        const forecast = await TrekForecast.findByPk(id);

        if (!forecast) {
            return res.status(404).json({ success: false, error: "Forecast not found" });
        }

        res.json({ success: true, data: forecast });
    } catch (error) {
        logger.error("Error fetching forecast:", error);
        res.status(500).json({ success: false, error: "Failed to fetch forecast" });
    }
};

// Create new forecast
const createForecast = async (req, res) => {
    try {
        const forecastData = buildForecastData(req.body);
        const forecast = await TrekForecast.create(forecastData);

        res.status(201).json({
            success: true,
            message: "Trek forecast created successfully",
            data: forecast,
        });
    } catch (error) {
        logger.error("Error creating forecast:", error);
        res.status(500).json({ success: false, error: "Failed to create forecast" });
    }
};

// Update forecast
const updateForecast = async (req, res) => {
    try {
        const { id } = req.params;
        const forecast = await TrekForecast.findByPk(id);

        if (!forecast) {
            return res.status(404).json({ success: false, error: "Forecast not found" });
        }

        const updateData = buildForecastData(req.body);

        // When updating, merge new metadata with existing rather than replacing entirely
        if (updateData.metadata && forecast.metadata) {
            updateData.metadata = { ...forecast.metadata, ...updateData.metadata };
        }

        await forecast.update(updateData);

        res.json({
            success: true,
            message: "Forecast updated successfully",
            data: forecast,
        });
    } catch (error) {
        logger.error("Error updating forecast:", error);
        res.status(500).json({ success: false, error: "Failed to update forecast" });
    }
};

// Delete forecast
const deleteForecast = async (req, res) => {
    try {
        const { id } = req.params;
        const forecast = await TrekForecast.findByPk(id);

        if (!forecast) {
            return res.status(404).json({ success: false, error: "Forecast not found" });
        }

        await forecast.destroy();
        res.json({ success: true, message: "Forecast deleted successfully" });
    } catch (error) {
        logger.error("Error deleting forecast:", error);
        res.status(500).json({ success: false, error: "Failed to delete forecast" });
    }
};

module.exports = {
    getAllForecasts,
    getForecastById,
    createForecast,
    updateForecast,
    deleteForecast,
};
