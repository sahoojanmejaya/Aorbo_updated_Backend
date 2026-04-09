const { CancellationPolicySettings } = require("../../models");
const logger = require("../../utils/logger");

// Get all cancellation policy settings
const getAllPolicySettings = async (req, res) => {
    try {
        logger.api("info", "Getting all cancellation policy settings", { userId: req.user?.id });

        const settings = await CancellationPolicySettings.findAll({
            order: [['policy_type', 'ASC'], ['created_at', 'DESC']]
        });

        res.status(200).json({
            success: true,
            data: settings,
            message: "Cancellation policy settings retrieved successfully"
        });

    } catch (error) {
        logger.api("error", "Error getting cancellation policy settings", {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to get cancellation policy settings",
            error: error.message
        });
    }
};

// Get policy settings by type
const getPolicySettingsByType = async (req, res) => {
    try {
        const { policyType } = req.params;
        
        if (!['flexible', 'standard'].includes(policyType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid policy type. Must be 'flexible' or 'standard'"
            });
        }

        logger.api("info", "Getting cancellation policy settings by type", { 
            userId: req.user?.id, 
            policyType 
        });

        const settings = await CancellationPolicySettings.findOne({
            where: { 
                policy_type: policyType,
                is_active: true 
            },
            order: [['created_at', 'DESC']]
        });

        if (!settings) {
            return res.status(404).json({
                success: false,
                message: `No active settings found for ${policyType} policy`
            });
        }

        res.status(200).json({
            success: true,
            data: settings,
            message: `${policyType} policy settings retrieved successfully`
        });

    } catch (error) {
        logger.api("error", "Error getting policy settings by type", {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to get policy settings",
            error: error.message
        });
    }
};

// Update policy settings
const updatePolicySettings = async (req, res) => {
    try {
        const { policyType } = req.params;
        const {
            // Flexible policy settings
            flexible_advance_non_refundable,
            flexible_full_payment_24h_deduction,
            // Standard policy settings
            standard_72h_plus_deduction,
            standard_48_72h_deduction,
            standard_24_48h_deduction,
            standard_under_24h_deduction
        } = req.body;

        if (!['flexible', 'standard'].includes(policyType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid policy type. Must be 'flexible' or 'standard'"
            });
        }

        logger.api("info", "Updating cancellation policy settings", { 
            userId: req.user?.id, 
            policyType,
            requestBody: req.body
        });

        // Validate input based on policy type
        if (policyType === 'flexible') {
            if (flexible_advance_non_refundable === undefined || flexible_full_payment_24h_deduction === undefined) {
                return res.status(400).json({
                    success: false,
                    message: "flexible_advance_non_refundable and flexible_full_payment_24h_deduction are required for flexible policy"
                });
            }

            if (flexible_full_payment_24h_deduction < 0 || flexible_full_payment_24h_deduction > 100) {
                return res.status(400).json({
                    success: false,
                    message: "flexible_full_payment_24h_deduction must be between 0 and 100"
                });
            }
        } else if (policyType === 'standard') {
            const requiredFields = [
                'standard_72h_plus_deduction',
                'standard_48_72h_deduction', 
                'standard_24_48h_deduction',
                'standard_under_24h_deduction'
            ];

            for (const field of requiredFields) {
                if (req.body[field] === undefined) {
                    return res.status(400).json({
                        success: false,
                        message: `${field} is required for standard policy`
                    });
                }

                if (req.body[field] < 0 || req.body[field] > 100) {
                    return res.status(400).json({
                        success: false,
                        message: `${field} must be between 0 and 100`
                    });
                }
            }
        }

        // Deactivate current active settings for this policy type
        await CancellationPolicySettings.update(
            { is_active: false },
            { where: { 
                policy_type: policyType,
                is_active: true 
            }}
        );

        // Create new active settings
        const newSettings = await CancellationPolicySettings.create({
            policy_type: policyType,
            flexible_advance_non_refundable: flexible_advance_non_refundable,
            flexible_full_payment_24h_deduction: flexible_full_payment_24h_deduction,
            standard_72h_plus_deduction: standard_72h_plus_deduction,
            standard_48_72h_deduction: standard_48_72h_deduction,
            standard_24_48h_deduction: standard_24_48h_deduction,
            standard_under_24h_deduction: standard_under_24h_deduction,
            is_active: true
        });

        res.status(200).json({
            success: true,
            data: newSettings,
            message: `${policyType} policy settings updated successfully`
        });

    } catch (error) {
        logger.api("error", "Error updating policy settings", {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to update policy settings",
            error: error.message
        });
    }
};

// Get policy settings history
const getPolicySettingsHistory = async (req, res) => {
    try {
        const { policyType } = req.query;

        logger.api("info", "Getting policy settings history", { 
            userId: req.user?.id, 
            policyType 
        });

        let whereClause = {};
        if (policyType && ['flexible', 'standard'].includes(policyType)) {
            whereClause.policy_type = policyType;
        }

        const history = await CancellationPolicySettings.findAll({
            where: whereClause,
            order: [['created_at', 'DESC']],
            limit: 20 // Get last 20 changes
        });

        res.status(200).json({
            success: true,
            data: history,
            message: "Policy settings history retrieved successfully"
        });

    } catch (error) {
        logger.api("error", "Error getting policy settings history", {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id
        });

        res.status(500).json({
            success: false,
            message: "Failed to get policy settings history",
            error: error.message
        });
    }
};

module.exports = {
    getAllPolicySettings,
    getPolicySettingsByType,
    updatePolicySettings,
    getPolicySettingsHistory
};
