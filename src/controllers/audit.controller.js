const auditService = require("../services/audit.service");
const { sendResponse } = require("../utils/response");

async function listAuditLogs(req, res, next) {
  try {
    const data = await auditService.listAuditLogs(req.query);

    return sendResponse(res, {
      success: true,
      data,
      message: "Audit logs retrieved successfully",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  listAuditLogs
};
