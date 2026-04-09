const express = require("express");
const router = express.Router();
const authController = require("../../controllers/admin/authController");
const authMiddleware = require("../../middleware/authMiddleware");

// Public routes (no authentication required)
router.post("/login", authController.login);

// Protected routes (authentication required)
router.use(authMiddleware);
router.get("/profile", authController.getProfile);
router.put("/profile", authController.updateProfile);
router.post("/logout", authController.logout);

module.exports = router;
