'use strict';

const express = require('express');
const router = express.Router();
const { registerDeviceToken, removeDeviceToken } = require('../../controllers/v1/deviceTokenController');
const { authenticateCustomer } = require('../../middleware/customerAuthMiddleware');

router.post('/', authenticateCustomer, registerDeviceToken);
router.delete('/', authenticateCustomer, removeDeviceToken);

module.exports = router;
