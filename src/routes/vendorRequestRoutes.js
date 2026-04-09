const express = require('express');
const router = express.Router();
const vendorRequestController = require('../controllers/vendorRequestController');

router.get('/', vendorRequestController.getAllRequests);
router.post('/', vendorRequestController.createRequest);
router.put('/:id/approve', vendorRequestController.approveRequest);
router.put('/:id/reject', vendorRequestController.rejectRequest);

module.exports = router;
