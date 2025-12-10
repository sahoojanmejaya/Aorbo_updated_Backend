const fs = require("fs");
const path = require("path");
const winston = require("winston");
require("winston-daily-rotate-file");

// Import email notification service
let emailNotificationService = null;
try {
    emailNotificationService = require("../services/emailNotificationService");
} catch (error) {
    console.warn("Email notification service not available:", error.message);
}

// Ensure logs directory exists
const logsDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for logs with timestamp
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: "YYYY-MM-DD HH:mm:ss",
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

        if (Object.keys(meta).length > 0) {
            log += `\nMetadata: ${JSON.stringify(meta, null, 2)}`;
        }

        if (stack) {
            log += `\nStack: ${stack}`;
        }

        return log;
    })
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
        format: "HH:mm:ss",
    }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let log = `${timestamp} [${level}]: ${message}`;

        if (Object.keys(meta).length > 0) {
            log += `\n${JSON.stringify(meta, null, 2)}`;
        }

        return log;
    })
);

// Create different loggers for different purposes
const createLogger = (category) => {
    const transports = [
        // Console transport for development
        new winston.transports.Console({
            format: consoleFormat,
            level: process.env.NODE_ENV === "production" ? "info" : "debug",
        }),

        // Daily rotating file transport for general logs
        new winston.transports.DailyRotateFile({
            filename: path.join(logsDir, `${category}-%DATE%.log`),
            datePattern: "YYYY-MM-DD",
            level: "info",
            maxSize: "20m",
            maxFiles: "14d", // Keep logs for 14 days
            format: logFormat,
        }),

        // Daily rotating file transport for error logs
        new winston.transports.DailyRotateFile({
            filename: path.join(logsDir, `${category}-error-%DATE%.log`),
            datePattern: "YYYY-MM-DD",
            level: "error",
            maxSize: "20m",
            maxFiles: "30d", // Keep error logs for 30 days
            format: logFormat,
        }),

        // Daily rotating file transport for debug logs (development only)
        ...(process.env.NODE_ENV !== "production"
            ? [
                  new winston.transports.DailyRotateFile({
                      filename: path.join(
                          logsDir,
                          `${category}-debug-%DATE%.log`
                      ),
                      datePattern: "YYYY-MM-DD",
                      level: "debug",
                      maxSize: "20m",
                      maxFiles: "7d", // Keep debug logs for 7 days
                      format: logFormat,
                  }),
              ]
            : []),
    ];

    return winston.createLogger({
        format: logFormat,
        transports,
        exitOnError: false,
    });
};

// Create specific loggers
const loggers = {
    app: createLogger("app"),
    api: createLogger("api"),
    auth: createLogger("auth"),
    booking: createLogger("booking"),
    trek: createLogger("trek"),
    vendor: createLogger("vendor"),
    admin: createLogger("admin"),
    database: createLogger("database"),
    payment: createLogger("payment"),
    email: createLogger("email"),
    error: createLogger("error"),
    general: createLogger("general"), // Add general logger for backward compatibility
};

// Enhanced Logger class with additional features
class Logger {
    constructor() {
        this.loggers = loggers;
    }

    // App-level logging
    app(level, message, meta = {}) {
        this.log("app", level, message, meta);
    }

    // API request/response logging
    api(level, message, meta = {}) {
        this.log("api", level, message, meta);
    }

    // Authentication logging
    auth(level, message, meta = {}) {
        this.log("auth", level, message, meta);
    }

    // Booking-related logging
    booking(level, message, meta = {}) {
        this.log("booking", level, message, meta);
    }

    // Trek-related logging
    trek(level, message, meta = {}) {
        this.log("trek", level, message, meta);
    }

    // Vendor-related logging
    vendor(level, message, meta = {}) {
        this.log("vendor", level, message, meta);
    }

    // Admin-related logging
    admin(level, message, meta = {}) {
        this.log("admin", level, message, meta);
    }

    // Database logging
    database(level, message, meta = {}) {
        this.log("database", level, message, meta);
    }

    // Payment logging
    payment(level, message, meta = {}) {
        this.log("payment", level, message, meta);
    }

    // Email logging
    email(level, message, meta = {}) {
        this.log("email", level, message, meta);
    }

    // Error logging
    error(level, message, meta = {}) {
        this.log("error", level, message, meta);
    }

    // General logging (for backward compatibility)
    general(level, message, meta = {}) {
        this.log("general", level, message, meta);
    }

    // Core logging method
    log(category, level, message, meta = {}) {
        if (this.loggers[category]) {
            // Add global request context if available
            const contextMeta = { ...meta };
            if (global.currentRequest) {
                contextMeta.requestId = global.currentRequest.id;
                contextMeta.userId = global.currentRequest.user?.id || null;
                contextMeta.ip = global.currentRequest.ip;
                contextMeta.userAgent = global.currentRequest.userAgent;
                contextMeta.method = global.currentRequest.method;
                contextMeta.url = global.currentRequest.url;
                contextMeta.duration = global.currentRequest.startTime ? Date.now() - global.currentRequest.startTime : null;
            }

            this.loggers[category][level](message, contextMeta);

            // Send email notification for errors if email service is available
            if (emailNotificationService && (level === 'error' || level === 'warn')) {
                this.sendErrorNotification(message, contextMeta, category, level);
            }
        } else {
            // Fallback to error logger if category doesn't exist
            console.warn(
                `Logger category '${category}' not found, using error logger`
            );
            this.loggers.error[level](message, meta);

            // Send email notification for error fallback
            if (emailNotificationService && (level === 'error' || level === 'warn')) {
                this.sendErrorNotification(message, meta, 'error', level);
            }
        }
    }

    // Convenience methods for each level
    info(category, message, meta = {}) {
        this.log(category, "info", message, meta);
    }

    error(category, message, meta = {}) {
        this.log(category, "error", message, meta);
    }

    warn(category, message, meta = {}) {
        this.log(category, "warn", message, meta);
    }

    debug(category, message, meta = {}) {
        this.log(category, "debug", message, meta);
    }

    // Request logging middleware
    logRequest(req, res, next) {
        const startTime = Date.now();

        // Store request context globally
        global.currentRequest = {
            id:
                req.headers["x-request-id"] ||
                `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            user: req.user || null,
            ip: req.ip,
            method: req.method,
            url: req.url,
            userAgent: req.get("User-Agent"),
            startTime,
        };

        // Log request start
        this.api("info", `Request started: ${req.method} ${req.url}`, {
            requestId: global.currentRequest.id,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            userId: req.user?.id || null,
            body: req.method !== "GET" ? req.body : undefined,
            query: req.query,
            params: req.params,
        });

        // Override res.end to log response
        const originalEnd = res.end;
        res.end = function (chunk, encoding) {
            const duration = Date.now() - startTime;

            // Log response
            logger.api("info", `Request completed: ${req.method} ${req.url}`, {
                requestId: global.currentRequest?.id,
                statusCode: res.statusCode,
                duration: `${duration}ms`,
                contentLength: res.get("Content-Length"),
            });

            // Clear global request context
            global.currentRequest = null;

            originalEnd.call(this, chunk, encoding);
        };

        next();
    }

    // Send error notification email
    async sendErrorNotification(message, meta, category, level) {
        if (!emailNotificationService) return;

        try {
            // Create error object for email service
            const error = new Error(message);
            if (meta.stack) {
                error.stack = meta.stack;
            }
            if (meta.error && typeof meta.error === 'string') {
                error.message = meta.error;
            }

            // Prepare context for email service
            const context = {
                category,
                level,
                requestId: meta.requestId,
                userId: meta.userId,
                method: meta.method,
                url: meta.url,
                ip: meta.ip,
                userAgent: meta.userAgent,
                duration: meta.duration,
                additionalData: {
                    ...meta,
                    logLevel: level,
                    logCategory: category,
                    timestamp: new Date().toISOString()
                }
            };

            // Send email notification asynchronously
            emailNotificationService.sendErrorNotification(error, context).catch(emailError => {
                console.error('Failed to send error notification email:', emailError.message);
            });
        } catch (err) {
            console.error('Error in sendErrorNotification:', err.message);
        }
    }

    // Enhanced error logging method for direct error objects
    logErrorObject(category, error, context = {}) {
        const meta = {
            error: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code,
            ...context
        };

        // Add global request context if available
        if (global.currentRequest) {
            meta.requestId = global.currentRequest.id;
            meta.userId = global.currentRequest.user?.id || null;
            meta.ip = global.currentRequest.ip;
            meta.userAgent = global.currentRequest.userAgent;
            meta.method = global.currentRequest.method;
            meta.url = global.currentRequest.url;
            meta.duration = global.currentRequest.startTime ? Date.now() - global.currentRequest.startTime : null;
        }

        // Log to file
        this.loggers[category] ?
            this.loggers[category].error(error.message, meta) :
            this.loggers.error.error(error.message, meta);

        // Send email notification
        if (emailNotificationService) {
            const emailContext = {
                category,
                requestId: meta.requestId,
                userId: meta.userId,
                method: meta.method,
                url: meta.url,
                ip: meta.ip,
                userAgent: meta.userAgent,
                duration: meta.duration,
                statusCode: context.statusCode,
                additionalData: {
                    ...context,
                    logCategory: category,
                    timestamp: new Date().toISOString()
                }
            };

            emailNotificationService.sendErrorNotification(error, emailContext).catch(emailError => {
                console.error('Failed to send error notification email:', emailError.message);
            });
        }
    }

    // Error logging middleware
    logError(err, req, res, next) {
        const context = {
            statusCode: res.statusCode || 500,
            requestId: global.currentRequest?.id,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userId: req.user?.id,
            userAgent: req.get('User-Agent'),
            body: req.method !== "GET" ? req.body : undefined,
            query: req.query,
            params: req.params
        };

        // Use enhanced error logging
        this.logErrorObject('error', err, context);

        next(err);
    }

    // Database query logging
    logQuery(sql, duration, meta = {}) {
        this.database("debug", "Database query executed", {
            sql,
            duration: `${duration}ms`,
            ...meta,
        });
    }

    // Performance logging
    logPerformance(operation, duration, meta = {}) {
        this.app("info", `Performance: ${operation}`, {
            duration: `${duration}ms`,
            ...meta,
        });
    }

    // Convenience methods for common error scenarios
    logPaymentError(error, paymentData = {}) {
        this.logErrorObject('payment', error, {
            category: 'payment',
            ...paymentData
        });
    }

    logDatabaseError(error, queryInfo = {}) {
        // Extract SQL query from error if available
        const sqlInfo = {
            sql: error.sql || queryInfo.sql || null,
            parameters: error.parameters || queryInfo.parameters || null,
            ...queryInfo
        };

        this.logErrorObject('database', error, {
            category: 'database',
            ...sqlInfo
        });
    }

    logAuthError(error, authData = {}) {
        this.logErrorObject('auth', error, {
            category: 'auth',
            ...authData
        });
    }

    logBookingError(error, bookingData = {}) {
        this.logErrorObject('booking', error, {
            category: 'booking',
            ...bookingData
        });
    }

    logTrekError(error, trekData = {}) {
        this.logErrorObject('trek', error, {
            category: 'trek',
            ...trekData
        });
    }

    logVendorError(error, vendorData = {}) {
        this.logErrorObject('vendor', error, {
            category: 'vendor',
            ...vendorData
        });
    }

    // Test email notification system
    async testEmailNotification() {
        if (!emailNotificationService) {
            console.error('Email notification service not available');
            return false;
        }

        try {
            const result = await emailNotificationService.sendTestEmail();
            if (result.success) {
                this.email('info', 'Test email sent successfully', {
                    messageId: result.messageId,
                    recipient: result.recipient
                });
                return true;
            } else {
                this.email('error', 'Test email failed', {
                    error: result.error
                });
                return false;
            }
        } catch (error) {
            this.email('error', 'Test email error', {
                error: error.message,
                stack: error.stack
            });
            return false;
        }
    }

    // Get email notification service status
    getEmailServiceStatus() {
        if (!emailNotificationService) {
            return { available: false, error: 'Service not loaded' };
        }

        return {
            available: true,
            status: emailNotificationService.getStatus()
        };
    }

    // Global error handler middleware for uncaught exceptions
    setupGlobalErrorHandling() {
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.logErrorObject('error', error, {
                category: 'uncaught_exception',
                fatal: true
            });

            console.error('Uncaught Exception:', error);

            // Give time for email to send before process exits
            setTimeout(() => {
                process.exit(1);
            }, 1000);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            const error = reason instanceof Error ? reason : new Error(String(reason));
            this.logErrorObject('error', error, {
                category: 'unhandled_rejection',
                promise: promise.toString()
            });

            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

        this.app('info', 'Global error handling setup complete');
    }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;
