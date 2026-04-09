const service = require("../services/payment.service");
const { sendResponse } = require("../utils/response");

/**
 * APP SETTLEMENT
 */
async function settleViaApp(req, res, next) {
  try {
    const result = await service.settlePendingViaApp(req.body);

    return sendResponse(res, {
      success: true,
      data: result,
      message: "Pending amount settled via app",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}

/**
 * VENDOR SETTLEMENT
 */
async function settleViaVendor(req, res, next) {
  try {
    const result = await service.settlePendingViaVendor(req.body);

    return sendResponse(res, {
      success: true,
      data: result,
      message: "Pending amount settled via vendor",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  settleViaApp,
  settleViaVendor
};
