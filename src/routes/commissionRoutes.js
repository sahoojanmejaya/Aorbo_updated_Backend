const express = require('express');
const router = express.Router();
const commissionController = require('../controllers/commissionController');

router.get('/', commissionController.getCommissionLogs);
router.post('/', commissionController.createCommissionLog);

module.exports = router;
