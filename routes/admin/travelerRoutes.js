const express = require("express");
const router = express.Router();
const travelerController = require("../../controllers/admin/travelerController");

// GET /api/admin/travelers
router.get("/", travelerController.getAllTravelers);

// GET /api/admin/travelers/stats
router.get("/stats", travelerController.getTravelerStats);

// GET /api/admin/travelers/customer/:customerId
router.get("/customer/:customerId", travelerController.getCustomerTravelers);

// GET /api/admin/travelers/:id
router.get("/:id", travelerController.getTravelerById);

// PUT /api/admin/travelers/:id
router.put("/:id", travelerController.updateTraveler);

// DELETE /api/admin/travelers/:id
router.delete("/:id", travelerController.deleteTraveler);

module.exports = router;
