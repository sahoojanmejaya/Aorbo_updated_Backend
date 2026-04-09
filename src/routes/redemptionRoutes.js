const express = require('express');
const router = express.Router();
const redemptionController = require('../controllers/redemptionController');

router.get('/', redemptionController.getAllRedemptions);
router.get('/stats', redemptionController.getStats);
router.post('/', redemptionController.createRedemption);

module.exports = router;
