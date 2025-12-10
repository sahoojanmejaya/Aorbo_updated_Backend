const app = require("./app");
const logger = require("./utils/logger");
const http = require("http");
const { Server } = require("socket.io");
const PORT = process.env.PORT || 5050;

// Setup global error handling
logger.setupGlobalErrorHandling();

// Log server startup
logger.app("info", "Starting Arobo Backend Server", {
    port: PORT,
    environment: process.env.NODE_ENV || "development",
    nodeVersion: process.version,
    emailServiceStatus: logger.getEmailServiceStatus()
});

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for now
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Initialize Socket.IO handlers
const socketManager = require("./socket/socketManager");
socketManager.initialize(io);

server.listen(PORT, async () => {
    logger.app("info", `Server started successfully on port ${PORT}`, {
        port: PORT,
        environment: process.env.NODE_ENV || "development",
    });

    // Test email notification system if available
    const emailStatus = logger.getEmailServiceStatus();
    if (emailStatus.available) {
        logger.app("info", "Email notification service initialized", emailStatus.status);

        // Send a test email in development mode
        if (process.env.NODE_ENV !== 'production') {
            logger.app("info", "Testing email notification system...");
            const testResult = await logger.testEmailNotification();
            if (testResult) {
                logger.app("info", "Email notification test successful");
            } else {
                logger.app("warn", "Email notification test failed - check SMTP configuration");
            }
        }
    } else {
        logger.app("warn", "Email notification service not available", emailStatus);
    }
});

server.on("error", (error) => {
    logger.logErrorObject("app", error, {
        context: "server_startup",
        port: PORT
    });
});

server.on("close", () => {
    logger.app("info", "Server shutting down");
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    logger.app("info", "SIGTERM received, starting graceful shutdown");
    server.close(() => {
        logger.app("info", "Server closed successfully");
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.app("info", "SIGINT received, starting graceful shutdown");
    server.close(() => {
        logger.app("info", "Server closed successfully");
        process.exit(0);
    });
});
