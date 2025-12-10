const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");

const authMiddleware = (req, res, next) => {
    logger.info("auth", "=== AUTH MIDDLEWARE STARTED ===");
    logger.info("auth", "Request details:", {
        method: req.method,
        url: req.url,
        headers: {
            authorization: req.headers.authorization
                ? "Bearer [HIDDEN]"
                : "No auth header",
            "user-agent": req.headers["user-agent"],
        },
    });

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        logger.warn("auth", "No valid authorization header found");
        return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    logger.info("auth", "Token extracted (length):", {
        tokenLength: token.length,
    });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // JWT token decoded successfully - debug log removed for performance

        req.user = decoded;
        logger.info("auth", "=== AUTH MIDDLEWARE COMPLETED ===");
        next();
    } catch (err) {
        // Handle JWT expiration specifically - don't send email notifications for expired tokens
        if (err.name === 'TokenExpiredError') {
            logger.warn("auth", "JWT token expired:", {
                error: err.message,
                name: err.name,
                tokenLength: token.length,
                endpoint: req.originalUrl,
                method: req.method,
            });
            return res.status(401).json({ 
                message: "Token expired", 
                code: "TOKEN_EXPIRED" 
            });
        }

        // Handle other JWT errors (malformed, invalid signature, etc.) - these might need investigation
        logger.error("auth", "JWT verification failed:", {
            error: err.message,
            name: err.name,
            tokenLength: token.length,
        });

        // Only log auth errors for non-expiration issues that might indicate security problems
        if (err.name !== 'TokenExpiredError') {
            logger.logAuthError(err, {
                category: 'jwt_verification',
                middleware: 'authMiddleware',
                errorType: err.name,
                tokenProvided: true,
                tokenLength: token.length,
                endpoint: req.originalUrl,
                method: req.method,
                statusCode: 401
            });
        }

        return res.status(401).json({ message: "Invalid token" });
    }
};

module.exports = authMiddleware;
