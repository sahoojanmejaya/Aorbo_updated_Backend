const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');

router.get('/', settingsController.getDiscountModes);
router.post('/', settingsController.createDiscountMode);
router.put('/:id', settingsController.updateDiscountMode);
router.delete('/:id', settingsController.deleteDiscountMode);

module.exports = router;
