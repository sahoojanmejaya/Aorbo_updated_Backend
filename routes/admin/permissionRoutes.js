const express = require("express");
const router = express.Router();
const permissionController = require("../../controllers/admin/permissionController");
const authMiddleware = require("../../middleware/authMiddleware");

// Public routes (no authentication required)
router.post("/", permissionController.createPermission);
router.put("/:id", permissionController.updatePermission);
router.delete("/:id", permissionController.deletePermission);
router.get("/", permissionController.getAllPermission);
router.get("/:id", permissionController.getPermissionById);

router.post("/assign", permissionController.assignPermissions);
router.get("/user/:user_id", permissionController.getUserPermissions);
router.get("/all/all-user-permissions", permissionController.getAllUserPermissions);

router.put("/per/updatedata", permissionController.updateUserPermissions);
router.delete("/remove/:role_id/:permission_id", permissionController.deleteSinglePermission);
router.delete("/remove-all/:role_id", permissionController.deleteAllPermissions);

module.exports = router;
