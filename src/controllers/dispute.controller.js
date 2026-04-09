const service = require("../services/dispute.service");
const { sendResponse } = require("../utils/response");

async function create(req, res, next) {
  try {
    console.log("🔥 DISPUTE BODY RECEIVED:", req.body);

    const dispute = await service.createDispute(req.body);

    return sendResponse(res, {
      success: true,
      data: dispute,
      message: "Dispute created successfully",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}

async function resolve(req, res, next) {
  try {
    const data = await service.resolveDispute(req.params.id, req.body);
    return sendResponse(res, {
      success: true,
      data,
      message: "Dispute updated",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  create,
  resolve
};
