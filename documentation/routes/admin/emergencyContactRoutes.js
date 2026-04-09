const express = require("express");
const router = express.Router();
const emergencyContactController = require("../../controllers/admin/emergencyContactController");
const authMiddleware = require("../../middleware/authMiddleware");

// All routes require admin authentication
router.use(authMiddleware);

// Emergency contact routes
router.get("/", emergencyContactController.getAllEmergencyContacts);
router.get("/stats", emergencyContactController.getEmergencyContactStats);
router.get("/:id", emergencyContactController.getEmergencyContactById);
router.get("/customer/:customerId", emergencyContactController.getCustomerEmergencyContacts);
router.put("/:id", emergencyContactController.updateEmergencyContact);
router.delete("/:id", emergencyContactController.deleteEmergencyContact);

module.exports = router;
