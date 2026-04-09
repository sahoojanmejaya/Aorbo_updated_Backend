const express = require("express");
const router = express.Router();
const registerController = require("../../controllers/admin/registrationController");
const authMiddleware = require("../../middleware/authMiddleware");

// Public routes (no authentication required)
router.post("/", registerController.register);
router.post("/login", registerController.login_all);
router.get("/", registerController.getUsersByRoleIds);
router.put("/:id", registerController.updateProfile);
router.delete("/:id", registerController.deleteUser);
module.exports = router;

