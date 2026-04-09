const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');

// Get manual payout requests
router.get('/', payoutController.getRequests);

module.exports = router;
