const express = require("express");

const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const { sequelize } = require("./models");
const { handleSequelizeErrors } = require("./middleware/validationMiddleware");
const logger = require("./utils/logger");
require("dotenv").config();



// Set global timezone to Indian Standard Time (IST)
process.env.TZ = 'Asia/Kolkata';

// Log timezone configuration
logger.app("info", "Timezone configured globally", {
    timezone: process.env.TZ,
    currentTime: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    utcOffset: '+05:30'
});

// Initialize Firebase
const { initializeFirebase } = require("./config/firebase");
try {
    initializeFirebase();
    logger.app("info", "Firebase initialized successfully");
} catch (error) {
    logger.error("error", "Failed to initialize Firebase", {
        error: error.message,
    });
}

// Initialize Settlement Cron Job
const settlementCron = require("./cron/settlementCron");
try {
    settlementCron.start();
    logger.app("info", "Settlement cron job initialized successfully");
} catch (error) {
    logger.error("error", "Failed to initialize settlement cron", {
        error: error.message,
    });
}

// Import v1 routes (for mobile app)
const v1Routes = require("./routes/v1");

// Import new structured routes
const adminRoutes = require("./routes/admin");
const vendorPanelRoutes = require("./routes/vendor");

const app = express();
app.use(express.static(path.join(__dirname, "public")));

// Serve index.html on root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});
// CORS configuration
const corsOptions = {
    origin: true, // Allow all origins temporarily
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
    ],
    optionsSuccessStatus: 200,
};

// Middleware
app.use(cors(corsOptions));

// Additional CORS handling for development and production
app.use((req, res, next) => {
    // Always allow all origins for now
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    next();
});

// Timeout middleware to prevent long-running requests
app.use((req, res, next) => {
    const timeout = 30000; // 30 seconds
    req.setTimeout(timeout, () => {
        logger.api("warn", "Request timeout", {
            url: req.url,
            method: req.method,
            ip: req.ip,
        });
        res.status(408).json({
            success: false,
            message: "Request timeout",
        });
    });
    next();
});

// Request logging middleware
app.use(logger.logRequest.bind(logger));

// Morgan logging (HTTP requests)
app.use(
    morgan("combined", {
        stream: {
            write: (message) => {
                logger.api("info", message.trim());
            },
        },
    })
);

// ⚡ CRITICAL: Apply multer middleware for trek images BEFORE JSON parser
const { uploadTrekImages } = require("./utils/trekImageUpload");
const authMiddleware = require("./middleware/authMiddleware");
const trekControllerUnified = require("./controllers/vendor/trekControllerUnified");

// Handle trek creation with file upload - COMPLETE route with controller!
app.post("/api/vendor/treks/create-complete", 
    authMiddleware,     // Auth first
    (req, res, next) => {
        console.log('🔍 Before multer - Content-Type:', req.get('Content-Type'));
        console.log('🔍 Before multer - Has body:', !!req.body);
        next();
    },
    uploadTrekImages,   // Multer processes files
    (req, res, next) => {
        console.log('✅ After multer - Body keys:', Object.keys(req.body || {}));
        console.log('✅ After multer - Files count:', req.files?.length || 0);
        console.log('✅ After multer - trekData exists:', !!req.body?.trekData);
        next();
    },
    trekControllerUnified.createCompleteTrek  // Controller
);

// NOW apply JSON parser for OTHER routes (not multipart/form-data)
const jsonParser = express.json({ limit: "50mb" });

// Conditional JSON parsing - skip for multipart/form-data
app.use((req, res, next) => {
    const contentType = req.get('Content-Type') || '';
    
    console.log('🔍 Content-Type:', contentType); // Debug log
    
    // Skip JSON parsing for multipart/form-data (file uploads)
    if (contentType.includes('multipart/form-data')) {
        console.log('✅ Skipping JSON parser for multipart/form-data');
        return next();
    }
    
    console.log('📝 Applying JSON parser');
    // Apply JSON parser for other requests
    jsonParser(req, res, next);
});

app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Static file serving for uploaded images
app.use("/storage", express.static(path.join(__dirname, "storage")));

// Specific route for trek images
app.use(
    "/trek-images",
    express.static(path.join(__dirname, "storage/trek-images"))
);

// Test endpoint for debugging (register before API routes)
app.get("/test", (req, res) => {
    res.json({
        message: "API is working",
        timestamp: new Date().toISOString(),
        headers: {
            origin: req.headers.origin,
            authorization: req.headers.authorization
                ? "Bearer [PRESENT]"
                : "NOT PRESENT",
        },
    });
});

// Trek health check endpoint
app.get("/api/vendor/treks/health", (req, res) => {
    res.json({
        success: true,
        message: "Trek API health check",
        timestamp: new Date().toISOString(),
        status: "healthy",
    });
});

// NEW API STRUCTURE
// Admin panel routes
app.use("/api/admin", adminRoutes);

// Vendor panel routes
app.use("/api/vendor", vendorPanelRoutes);

// Mobile app routes (v1)
app.use("/api/v1", v1Routes);


// LEGACY ROUTES (maintain backward compatibility)
// Note: Legacy routes have been moved to organized structure
// Use /api/admin, /api/vendor, or /api/v1 endpoints instead

// Health check
app.get("/health", (req, res) =>
    res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
    })
);

// API documentation endpoint
app.get("/api", (req, res) => {
    res.json({
        name: "Arobo Trekking Platform API",
        version: "1.0.0",
        description: "RESTful API for the Arobo trekking platform",
        endpoints: {
            admin: {
                base: "/api/admin",
                description: "Admin panel endpoints",
                activities: "/api/admin/activities",
            },
            vendor: {
                base: "/api/vendor",
                description: "Vendor panel endpoints",
                auth: "/api/vendor/auth", 
                treks: "/api/vendor/treks",
                bookings: "/api/vendor/bookings",
                customers: "/api/vendor/customers",
                locations: "/api/vendor/locations",
                analytics: "/api/vendor/analytics",
            },
            v1: {
                base: "/api/v1",
                description: "Mobile app endpoints",
                customer_auth: "/api/v1/customer/auth",
                customer_bookings: "/api/v1/customer/bookings",
                travelers: "/api/v1/customer/travelers",
                treks: "/api/v1/treks",
            },
            legacy: {
                description:
                    "Legacy endpoints have been moved to organized structure",
                note: "Use /api/vendor or /api/v1 endpoints instead",
            },
        },
        documentation: "https://your-docs-url.com",
    });
});

// Enhanced error handling middleware
app.use(handleSequelizeErrors);

// Error logging middleware
app.use(logger.logError.bind(logger));

// General error handling
app.use((err, req, res, next) => {
    // Log the error
    logger.error("error", "Unhandled application error", {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userId: req.user?.id,
    });

    // Handle specific error types
    if (err.name === "ValidationError") {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: err.errors,
        });
    }

    if (err.name === "UnauthorizedError") {
        return res.status(401).json({
            success: false,
            message: "Unauthorized access",
        });
    }

    // Default error response
    res.status(500).json({
        success: false,
        message: "Internal Server Error",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
        availableRoutes: ["/api/vendor", "/api/v1", "/api", "/health"],
    });
});

// Removed database synchronization here; use the standalone sync.js script instead

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
    logger.error("error", "Unhandled Promise Rejection", {
        reason: reason,
        promise: promise,
        stack: reason.stack,
    });
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
    logger.error("error", "Uncaught Exception", {
        error: error.message,
        stack: error.stack,
    });
    process.exit(1);
});

module.exports = app;
