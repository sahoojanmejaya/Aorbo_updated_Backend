const express = require("express");
const router = express.Router();
const emergencyContactController = require("../../controllers/v1/emergencyContactController");
const {
    authenticateCustomer,
} = require("../../middleware/customerAuthMiddleware");

// All routes require customer authentication
router.use(authenticateCustomer);

router.get("/", emergencyContactController.getEmergencyContacts);
router.post("/", emergencyContactController.createEmergencyContact);
router.put("/:id", emergencyContactController.updateEmergencyContact);
router.delete("/:id", emergencyContactController.deleteEmergencyContact);

module.exports = router;
