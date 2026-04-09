const express = require("express");
const router = express.Router();
const roleController = require("../../controllers/admin/roleController");
const authMiddleware = require("../../middleware/authMiddleware");

// Public routes (no authentication required)
router.post("/", roleController.createRole);
router.put("/:id", roleController.updateRole);
router.delete("/:id", roleController.deleteRole);
router.get("/", roleController.getAllRoles);
router.get("/:id", roleController.getRoleById);
module.exports = router;
