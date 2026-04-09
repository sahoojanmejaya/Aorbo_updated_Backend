const express = require("express");
const router = express.Router();
const issueController = require("../../controllers/admin/issueController");

// GET /api/admin/issues
router.get("/", issueController.getAllIssues);

// GET /api/admin/issues/stats
router.get("/stats", issueController.getIssueStats);

// GET /api/admin/issues/:id
router.get("/:id", issueController.getIssueById);

// PUT /api/admin/issues/:id
router.put("/:id", issueController.updateIssue);

// DELETE /api/admin/issues/:id
router.delete("/:id", issueController.deleteIssue);

module.exports = router;
