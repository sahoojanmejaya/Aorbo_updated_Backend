'use strict';

const express = require('express');
const router = express.Router();
const { registerDeviceToken, removeDeviceToken } = require('../../controllers/vendor/deviceTokenController');

// Auth middleware is already applied at the vendor router level (routes/vendor/index.js)
router.post('/', registerDeviceToken);
router.delete('/', removeDeviceToken);

module.exports = router;
