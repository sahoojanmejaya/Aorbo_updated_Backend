'use strict';

const { Customer } = require('../../models');
const logger = require('../../utils/logger');

/**
 * POST /api/v1/customer/device-token
 * Registers or updates the FCM device token for the authenticated customer.
 * Identity sourced from JWT (req.customer.id).
 */
const registerDeviceToken = async (req, res) => {
    try {
        const customerId = req.customer?.id;
        if (!customerId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { device_token } = req.body;
        if (!device_token || typeof device_token !== 'string' || device_token.trim() === '') {
            return res.status(400).json({ success: false, error: 'device_token is required' });
        }

        await Customer.update(
            { device_token: device_token.trim() },
            { where: { id: customerId } }
        );

        res.json({ success: true, message: 'Device token registered' });
    } catch (error) {
        logger.error('Error registering customer device token:', error);
        res.status(500).json({ success: false, error: 'Failed to register device token' });
    }
};

/**
 * DELETE /api/v1/customer/device-token
 * Clears the FCM device token (logout / notification opt-out).
 */
const removeDeviceToken = async (req, res) => {
    try {
        const customerId = req.customer?.id;
        if (!customerId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        await Customer.update(
            { device_token: null },
            { where: { id: customerId } }
        );

        res.json({ success: true, message: 'Device token removed' });
    } catch (error) {
        logger.error('Error removing customer device token:', error);
        res.status(500).json({ success: false, error: 'Failed to remove device token' });
    }
};

module.exports = { registerDeviceToken, removeDeviceToken };
