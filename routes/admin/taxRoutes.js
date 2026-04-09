'use strict';

const express       = require('express');
const router        = express.Router();
const taxController = require('../../controllers/admin/taxController');

// GET /api/admin/taxes/summary  — monthly GST + platform-fee summary
router.get('/summary', taxController.getTaxSummary);

// GET /api/admin/taxes/records  — paginated per-booking tax records
router.get('/records', taxController.getTaxRecords);

module.exports = router;
