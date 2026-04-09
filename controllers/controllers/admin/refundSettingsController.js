const { RefundSettings } = require("../../models");
const logger = require("../../utils/logger");

// Get refund settings
const getRefundSettings = async (req, res) => {
    try {
        logger.api("info", "Getting refund settings", { userId: req.user?.id });

        // Get the active refund settings (there should only be one active record)
        const refundSettings = await RefundSettings.findOne({
            where: { is_active: true },
            order: [['created_at', 'DESC']]
        });

        if (!refundSettings) {
            // If no settings exist, create default ones
            const defaultSettings = await RefundSettings.create({
                seven_days_percentage: 90,
                three_days_percentage: 50,
                twenty_four_hours_percentage: 10,
                is_active: true
            });

            return res.status(200).json({
                success: true,
                data: defaultSettings,
                message: "Default refund settings created"
            });
        }

        res.status(200).json({
            success: true,
            data: refundSettings,
            message: "Refund settings retrieved successfully"
        });

    } catch (error) {
        logger.api("error", "Error getting refund settings", {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to get refund settings",
            error: error.message
        });
    }
};

// Update refund settings
const updateRefundSettings = async (req, res) => {
    try {
        const { seven_days_percentage, three_days_percentage, twenty_four_hours_percentage } = req.body;

        logger.api("info", "Updating refund settings", { 
            userId: req.user?.id,
            seven_days_percentage,
            three_days_percentage,
            twenty_four_hours_percentage
        });

        // Validate input
        if (seven_days_percentage === undefined || three_days_percentage === undefined || twenty_four_hours_percentage === undefined) {
            return res.status(400).json({
                success: false,
                message: "All percentage fields are required"
            });
        }

        if (seven_days_percentage < 0 || seven_days_percentage > 100 ||
            three_days_percentage < 0 || three_days_percentage > 100 ||
            twenty_four_hours_percentage < 0 || twenty_four_hours_percentage > 100) {
            return res.status(400).json({
                success: false,
                message: "All percentages must be between 0 and 100"
            });
        }

        // Deactivate current active settings
        await RefundSettings.update(
            { is_active: false },
            { where: { is_active: true } }
        );

        // Create new active settings
        const newSettings = await RefundSettings.create({
            seven_days_percentage,
            three_days_percentage,
            twenty_four_hours_percentage,
            is_active: true
        });

        res.status(200).json({
            success: true,
            data: newSettings,
            message: "Refund settings updated successfully"
        });

    } catch (error) {
        logger.api("error", "Error updating refund settings", {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to update refund settings",
            error: error.message
        });
    }
};

// Get refund settings history
const getRefundSettingsHistory = async (req, res) => {
    try {
        logger.api("info", "Getting refund settings history", { userId: req.user?.id });

        const settingsHistory = await RefundSettings.findAll({
            order: [['created_at', 'DESC']],
            limit: 10 // Get last 10 changes
        });

        res.status(200).json({
            success: true,
            data: settingsHistory,
            message: "Refund settings history retrieved successfully"
        });

    } catch (error) {
        logger.api("error", "Error getting refund settings history", {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to get refund settings history",
            error: error.message
        });
    }
};

module.exports = {
    getRefundSettings,
    updateRefundSettings,
    getRefundSettingsHistory
};










