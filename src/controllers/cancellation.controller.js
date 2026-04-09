const service = require("../services/cancellationPreview.service");
const { sendResponse } = require("../utils/response");

async function preview(req, res, next) {
  try {
    const { tbrId, bookingId } = req.params;
    const data = await service.previewCancellation(tbrId, bookingId);

    return sendResponse(res, {
      success: true,
      data,
      message: "Cancellation preview calculated",
      errors: null
    });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  preview
};
