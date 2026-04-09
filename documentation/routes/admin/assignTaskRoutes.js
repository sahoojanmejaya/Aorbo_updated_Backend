const express = require("express");
const router = express.Router();
const assignController = require("../../controllers/admin/assign_ticket.js");
const authMiddleware = require("../../middleware/authMiddleware");

// Public routes (no authentication required)

router.post("/", assignController.assignTask);
router.post("/add_issues", assignController.submitIssueReport);
router.put("/", assignController.assignTask);
router.get("/:vendor_id", assignController.getReportsByVendor);
router.get("/count_task/:assigned_to", assignController.getAgentTaskcount);
module.exports = router;

