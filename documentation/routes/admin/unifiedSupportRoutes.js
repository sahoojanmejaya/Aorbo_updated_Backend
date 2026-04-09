const express = require("express");
const router = express.Router();
const unifiedController = require("../../controllers/admin/unifiedSupport");
const authMiddleware = require("../../middleware/authMiddleware");

// Public routes (no authentication required)

router.get("/", unifiedController.getUnifiedSupport);
router.get("/get_ticket/:agent_id", unifiedController.getTicketsByAgent);
module.exports = router;
