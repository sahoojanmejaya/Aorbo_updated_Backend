const express = require('express');
const router = express.Router();
const tbrController = require('../controllers/tbrController');

// Get all TBRs (Trek Batch Records)
router.get('/', tbrController.getTBRs);

module.exports = router;
