const service = require("../services/vendorRequest.service");
const { sendResponse } = require("../utils/response");

async function listAllRequests(req, res, next) {
  try {
    const data = await service.getAll(req.query);
    return sendResponse(res, {
      success: true,
      data,
      message: "All vendor requests retrieved successfully",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}

async function listPendingRequests(req, res, next) {
  try {
    const data = await service.getPending(req.query);
    return sendResponse(res, {
      success: true,
      data,
      message: "Pending requests retrieved successfully",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}

async function listDecisionHistory(req, res, next) {
  try {
    const data = await service.getHistory(req.query);
    return sendResponse(res, {
      success: true,
      data,
      message: "Decision history retrieved successfully",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}

async function approveRequest(req, res, next) {
  try {
    const { requestId } = req.params;
    const payload = req.body;

    const result = await service.approve(requestId, payload);

    return sendResponse(res, {
      success: true,
      data: result,
      message: "Vendor request approved successfully",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}

async function rejectRequest(req, res, next) {
  try {
    const { requestId } = req.params;
    const payload = req.body;

    const result = await service.reject(requestId, payload);

    return sendResponse(res, {
      success: true,
      data: result,
      message: "Vendor request rejected successfully",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  listAllRequests,
  listPendingRequests,
  listDecisionHistory,
  approveRequest,
  rejectRequest
};
