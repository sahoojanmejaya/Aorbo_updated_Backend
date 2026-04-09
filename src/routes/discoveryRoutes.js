const express = require('express');
const router = express.Router();
const {
  discoveryContentController,
  homeThemesController,
  trekForecastsController
} = require('../controllers/discoveryController');

// Discovery Content Routes
router.get('/discovery-content', discoveryContentController.getAll);
router.get('/discovery-content/:id', discoveryContentController.getById);
router.post('/discovery-content', discoveryContentController.create);
router.put('/discovery-content/:id', discoveryContentController.update);
router.delete('/discovery-content/:id', discoveryContentController.delete);

// Home Themes Routes
router.get('/home-themes', homeThemesController.getAll);
router.get('/home-themes/:id', homeThemesController.getById);
router.post('/home-themes', homeThemesController.create);
router.put('/home-themes/:id', homeThemesController.update);
router.delete('/home-themes/:id', homeThemesController.delete);

// Trek Forecasts Routes
router.get('/trek-forecasts', trekForecastsController.getAll);
router.get('/trek-forecasts/:id', trekForecastsController.getById);
router.post('/trek-forecasts', trekForecastsController.create);
router.put('/trek-forecasts/:id', trekForecastsController.update);
router.delete('/trek-forecasts/:id', trekForecastsController.delete);

module.exports = router;
