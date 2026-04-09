const express = require("express");
const router = express.Router();
const operatorController = require("../controllers/operator.controller");

router.get("/", operatorController.listOperators);
router.get("/:id", operatorController.getOperatorById);

module.exports = router;
