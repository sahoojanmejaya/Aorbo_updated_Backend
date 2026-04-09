const router = require("express").Router();
const controller = require("../controllers/payment.controller");

/**
 * Pending settlement via APP
 */
router.post("/settle-pending/app", controller.settleViaApp);

/**
 * Pending settlement via VENDOR
 */
router.post("/settle-pending/vendor", controller.settleViaVendor);

module.exports = router;
