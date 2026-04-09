'use strict';

const { Vendor } = require('../../models');
const logger = require('../../utils/logger');

/**
 * POST /api/vendor/device-token
 * Registers or updates the FCM device token for the authenticated vendor.
 * Identity sourced from JWT (req.vendor.id via secureAuthMiddleware).
 */
const registerDeviceToken = async (req, res) => {
    try {
        const vendorId = req.vendor?.id;
        if (!vendorId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { device_token } = req.body;
        if (!device_token || typeof device_token !== 'string' || device_token.trim() === '') {
            return res.status(400).json({ success: false, error: 'device_token is required' });
        }

        await Vendor.update(
            { device_token: device_token.trim() },
            { where: { id: vendorId } }
        );

        res.json({ success: true, message: 'Device token registered' });
    } catch (error) {
        logger.error('Error registering vendor device token:', error);
        res.status(500).json({ success: false, error: 'Failed to register device token' });
    }
};

/**
 * DELETE /api/vendor/device-token
 * Clears the FCM device token (logout / notification opt-out).
 */
const removeDeviceToken = async (req, res) => {
    try {
        const vendorId = req.vendor?.id;
        if (!vendorId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        await Vendor.update(
            { device_token: null },
            { where: { id: vendorId } }
        );

        res.json({ success: true, message: 'Device token removed' });
    } catch (error) {
        logger.error('Error removing vendor device token:', error);
        res.status(500).json({ success: false, error: 'Failed to remove device token' });
    }
};

module.exports = { registerDeviceToken, removeDeviceToken };
