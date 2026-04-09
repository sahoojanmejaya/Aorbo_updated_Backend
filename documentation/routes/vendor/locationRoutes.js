const express = require("express");
const router = express.Router();
const locationController = require("../../controllers/vendor/locationController");

// Vendor location routes (full city management, boarding points)
router.get("/states", locationController.getStates);
router.get("/cities", locationController.getCities);
router.get("/cities/search", locationController.searchCities);
router.get("/cities/:id", locationController.getCityById);
router.post("/cities", locationController.createCity);
router.put("/cities/:id", locationController.updateCity);
router.delete("/cities/:id", locationController.deleteCity);
router.get("/cities/:id/boarding-points", locationController.getBoardingPoints);
router.get("/boarding-points", locationController.getBoardingPoints);
router.post("/boarding-points", locationController.createBoardingPoint);
router.put("/boarding-points/:id", locationController.updateBoardingPoint);
router.delete("/boarding-points/:id", locationController.deleteBoardingPoint);

module.exports = router;
