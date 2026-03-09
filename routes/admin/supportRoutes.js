const express = require("express");
const router = express.Router();
const supportController = require("../../controllers/admin/supportDashboardController");
const authMiddleware = require("../../middleware/authMiddleware");

// Public routes (no authentication required)

router.get("/:role_id", supportController.getuserbyRoleId);
router.get("/get_report/:id", supportController.getUserReport);
router.get("/get_teamreport/:id", supportController.getTeamReport);
router.get("/get_ticket/:id", supportController.getTicketbyId);
router.post("/add_comment/:issue_id", supportController.addComment);
router.get("/history/:id", supportController.getActivityHistory);
router.put("/update_status/:id", supportController.updateTicketStatus);
module.exports = router;
