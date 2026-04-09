const express = require("express");
const router = express.Router();
const controller = require("../controllers/audit.controller");

/**
 * LIST AUDIT LOGS (Phase 9)
 */
router.get("/", controller.listAuditLogs);

module.exports = router;
