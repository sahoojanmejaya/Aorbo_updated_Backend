const express = require("express");
const router = express.Router();
const controller = require("../controllers/vendorRequest.controller");

router.get("/", controller.listAllRequests);
router.get("/pending", controller.listPendingRequests);
router.get("/history", controller.listDecisionHistory);

router.post("/:requestId/approve", controller.approveRequest);
router.post("/:requestId/reject", controller.rejectRequest);

module.exports = router;
