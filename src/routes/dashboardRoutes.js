const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// Dashboard Stats
router.get('/stats', dashboardController.getDashboardStats);
router.get('/trend', dashboardController.getTrendData);
router.get('/scope-distribution', dashboardController.getScopeDistribution);

module.exports = router;
