const logger = require("../utils/logger");

// Middleware to log API requests with detailed information
const logApiRequest = (req, res, next) => {
    const startTime = Date.now();

    // Log request details
    logger.api("info", `API Request: ${req.method} ${req.originalUrl}`, {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        userId: req.user?.id,
        body: req.method !== "GET" ? req.body : undefined,
        query: req.query,
        params: req.params,
        headers: {
            "content-type": req.get("Content-Type"),
            authorization: req.get("Authorization") ? "Bearer ***" : undefined,
        },
    });

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
        const duration = Date.now() - startTime;

        // Log response details
        logger.api("info", `API Response: ${req.method} ${req.originalUrl}`, {
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            contentLength: res.get("Content-Length"),
            responseHeaders: {
                "content-type": res.get("Content-Type"),
            },
        });

        originalEnd.call(this, chunk, encoding);
    };

    next();
};

// Middleware to log authentication events
const logAuthEvent = (event, details = {}) => {
    logger.auth("info", `Authentication Event: ${event}`, details);
};

// Middleware to log database operations
const logDatabaseOperation = (operation, details = {}) => {
    logger.database("info", `Database Operation: ${operation}`, details);
};

// Middleware to log payment events
const logPaymentEvent = (event, details = {}) => {
    logger.payment("info", `Payment Event: ${event}`, details);
};

// Middleware to log booking events
const logBookingEvent = (event, details = {}) => {
    logger.booking("info", `Booking Event: ${event}`, details);
};

// Middleware to log trek events
const logTrekEvent = (event, details = {}) => {
    logger.trek("info", `Trek Event: ${event}`, details);
};

// Middleware to log vendor events
const logVendorEvent = (event, details = {}) => {
    logger.vendor("info", `Vendor Event: ${event}`, details);
};

// Middleware to log admin events
const logAdminEvent = (event, details = {}) => {
    logger.admin("info", `Admin Event: ${event}`, details);
};

// Middleware to log email events
const logEmailEvent = (event, details = {}) => {
    logger.email("info", `Email Event: ${event}`, details);
};

// Middleware to log performance metrics
const logPerformance = (operation, duration, details = {}) => {
    logger.app("info", `Performance: ${operation}`, {
        duration: `${duration}ms`,
        ...details,
    });
};

// Middleware to log errors with context
const logError = (error, context = {}) => {
    logger.error("error", "Application Error", {
        error: error.message,
        stack: error.stack,
        ...context,
    });
};

// Middleware to log debug information
const logDebug = (message, details = {}) => {
    logger.app("debug", message, details);
};

// Middleware to log warnings
const logWarning = (message, details = {}) => {
    logger.app("warn", message, details);
};

// Middleware to log info messages
const logInfo = (message, details = {}) => {
    logger.app("info", message, details);
};

module.exports = {
    logApiRequest,
    logAuthEvent,
    logDatabaseOperation,
    logPaymentEvent,
    logBookingEvent,
    logTrekEvent,
    logVendorEvent,
    logAdminEvent,
    logEmailEvent,
    logPerformance,
    logError,
    logDebug,
    logWarning,
    logInfo,
};
