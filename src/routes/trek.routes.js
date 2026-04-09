
const express = require('express');
const router = express.Router();
const trekController = require('../controllers/trek.controller');

router.get('/', trekController.getAllTreks);

module.exports = router;
