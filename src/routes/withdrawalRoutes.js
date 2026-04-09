const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');

router.get('/', withdrawalController.getAllWithdrawals);
router.post('/', withdrawalController.createWithdrawal);
router.put('/:id/approve', withdrawalController.approveWithdrawal);
router.put('/:id/reject', withdrawalController.rejectWithdrawal);

module.exports = router;
