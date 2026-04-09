const express = require("express");
const router = express.Router();
const taxController = require("../../controllers/vendor/taxesController");
const authMiddleware = require("../../middleware/authMiddleware");

// All routes require authentication
router.use(authMiddleware);

// Vendor tax routes
router.get("/", taxController.getTaxes);


module.exports = router;
