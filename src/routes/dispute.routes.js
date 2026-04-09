const router = require("express").Router();
const controller = require("../controllers/dispute.controller");

router.post("/", controller.create);
router.post("/:id/resolve", controller.resolve);

module.exports = router;
