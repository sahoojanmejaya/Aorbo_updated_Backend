const express = require('express');
const router = express.Router();
const badgeController = require('../controllers/badgeController');

// Routes
router.get('/', badgeController.getAllBadges);
router.post('/', badgeController.createBadge);
router.put('/:id', badgeController.updateBadge);
router.patch('/:id/status', badgeController.toggleStatus);
router.delete('/:id', badgeController.deleteBadge);

module.exports = router;
