const express = require('express');
const router = express.Router();
const trekCaptainController = require('../../controllers/vendor/trekCaptainController');
const authMiddleware = require('../../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Get all trek captains for the vendor
router.get('/', trekCaptainController.getTrekCaptains);

// Get a single trek captain
router.get('/:id', trekCaptainController.getTrekCaptain);

// Create a new trek captain
router.post('/', trekCaptainController.createTrekCaptain);

// Update a trek captain
router.put('/:id', trekCaptainController.updateTrekCaptain);

// Delete a trek captain
router.delete('/:id', trekCaptainController.deleteTrekCaptain);

// Toggle captain status
router.patch('/:id/toggle-status', trekCaptainController.toggleCaptainStatus);

module.exports = router; 