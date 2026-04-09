const express = require("express");
const router = express.Router();
const locationController = require("../../controllers/admin/locationController");

// Admin location routes (full management of all location entities)
// States management
router.get("/states", locationController.getStates);
router.get("/states/:id", locationController.getStateById);
router.post("/states", locationController.createState);
router.put("/states/:id", locationController.updateState);
router.delete("/states/:id", locationController.deleteState);

// Cities management
router.get("/cities", locationController.getCities);
router.get("/cities/:id", locationController.getCityById);
router.post("/cities", locationController.createCity);
router.put("/cities/:id", locationController.updateCity);
router.delete("/cities/:id", locationController.deleteCity);

// Destinations management
router.get("/destinations", locationController.getDestinations);
router.get("/destinations/:id", locationController.getDestinationById);
router.post("/destinations", locationController.createDestination);
router.put("/destinations/:id", locationController.updateDestination);
router.delete("/destinations/:id", locationController.deleteDestination);

module.exports = router;
