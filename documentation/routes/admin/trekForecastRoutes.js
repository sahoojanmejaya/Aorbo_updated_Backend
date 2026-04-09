const express = require("express");
const router = express.Router();
const {
    getAllForecasts,
    getForecastById,
    createForecast,
    updateForecast,
    deleteForecast
} = require("../../controllers/admin/trekForecastController");

// GET /api/admin/trek-forecasts - Get all forecasts
router.get("/", getAllForecasts);

// GET /api/admin/trek-forecasts/:id - Get single forecast
router.get("/:id", getForecastById);

// POST /api/admin/trek-forecasts - Create new forecast
router.post("/", createForecast);

// PUT /api/admin/trek-forecasts/:id - Update forecast
router.put("/:id", updateForecast);

// DELETE /api/admin/trek-forecasts/:id - Delete forecast
router.delete("/:id", deleteForecast);

module.exports = router;
