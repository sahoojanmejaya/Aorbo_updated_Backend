const { sendResponse } = require("../utils/response");

function errorHandler(err, req, res, next) {
  console.error("❌ Error:", err);

  return sendResponse(res, {
    success: false,
    data: null,
    message: err.message || "Internal server error",
    errors: err.errors || { system: "Unexpected failure" }
  }, err.statusCode || 500);
}

module.exports = { errorHandler };
