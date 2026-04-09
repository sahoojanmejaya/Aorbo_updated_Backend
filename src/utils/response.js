function sendResponse(res, payload, statusCode = 200) {
  return res.status(statusCode).json({
    success: payload.success,
    data: payload.data ?? null,
    message: payload.message || "",
    errors: payload.errors ?? null
  });
}

module.exports = { sendResponse };
