const tbrService = require("../services/tbr.service");
const statisticsService = require("../services/statistics.service");
const { sendResponse } = require("../utils/response");

/**
 * --------------------------------------------------
 * LIST TBRs (Batches)
 * --------------------------------------------------
 */
async function listTBRs(req, res, next) {
  try {
    const data = await tbrService.getTBRList(req.query);

    return sendResponse(res, {
      success: true,
      data,
      message: "TBRs retrieved successfully",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}

/**
 * --------------------------------------------------
 * GET SINGLE TBR WITH BOOKINGS
 * --------------------------------------------------
 */
async function getTBRById(req, res, next) {
  try {
    const { tbrId } = req.params;

    const tbr = await tbrService.getTBRWithBookings(tbrId);

    if (!tbr) {
      return sendResponse(
        res,
        {
          success: false,
          data: null,
          message: "Resource not found",
          errors: {
            tbrId: `TBR with ID ${tbrId} does not exist`
          }
        },
        404
      );
    }

    return sendResponse(res, {
      success: true,
      data: tbr,
      message: "TBR details retrieved successfully",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}

/**
 * --------------------------------------------------
 * GET TBR STATISTICS
 * --------------------------------------------------
 */
async function getTBRStatistics(req, res, next) {
  try {
    const { tbrId } = req.params;

    const stats = await statisticsService.getTBRStatistics(tbrId);

    return sendResponse(res, {
      success: true,
      data: stats,
      message: "Statistics calculated successfully",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}

/**
 * --------------------------------------------------
 * CANCEL TBR (Batch)
 * --------------------------------------------------
 */
async function cancelTBR(req, res, next) {
  try {
    const { tbrId } = req.params;
    const { reason } = req.body;

    // Fallback if req.user is not populated by middleware (for safety)
    const adminUser = req.user || { id: 'ADM-SYSTEM', name: 'System Admin' };

    if (!reason) {
      return sendResponse(res, { success: false, message: "Cancellation reason is required" }, 400);
    }

    const result = await tbrService.cancelBatch(tbrId, reason, adminUser);

    return sendResponse(res, {
      success: true,
      data: result,
      message: "Batch cancelled successfully",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  listTBRs,
  getTBRById,
  getTBRStatistics,
  cancelTBR
};
