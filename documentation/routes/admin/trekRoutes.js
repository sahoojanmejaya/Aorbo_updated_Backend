// Added by Krishna
const express = require('express');
const router = express.Router();
const trekController = require('../../controllers/admin/trekController');

    router.put('/:id', trekController.updateTrek);

module.exports = router;
