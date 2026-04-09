const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');

// Get all payouts (vendor payout history)
router.get('/', payoutController.getPayouts);

// Get manual payout requests
router.get('/requests', payoutController.getRequests);

module.exports = router;
