const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { errorHandler } = require("./middlewares/error.middleware");
const { sendResponse } = require("./utils/response");

const app = express();

/**
 * -------------------
 * Global Middlewares
 * -------------------
 */
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

/**
 * -------------------
 * Static Files (Trek Images with CORS)
 * -------------------
 */
const path = require("path");
app.use('/trek-images', express.static(path.join(__dirname, '../../trek-images'), {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
  }
}));


/**
 * -------------------
 * Health Check
 * -------------------
 */
app.get("/health", (req, res) => {
  return sendResponse(res, {
    success: true,
    data: { 
      status: "OK",
      modules: [
        "Booking & Trek Management",
        "Coupon & Badge System",
        "Vendor Operations",
        "Finance & Tax Compliance",
        "Payment & Dispute Management"
      ],
      endpoints: {
        bookings: "/api/bookings, /api/tbrs",
        coupons: "/api/coupons, /api/badges, /api/redemptions",
        vendors: "/api/vendors, /api/vendor-requests, /api/operators",
        finance: "/api/commission-logs, /api/payout-batches, /api/withdrawals",
        treks: "/api/treks",
        payments: "/api/payments, /api/disputes",
        dashboard: "/api/dashboard"
      }
    },
    message: "Unified Backend is running",
    errors: null
  });
});

/**
 * -------------------
 * API Routes - UNIFIED BACKEND
 * -------------------
 */

// ========== BOOKING & TREK MANAGEMENT (backend_1) ==========
app.use("/api/tbrs", require("./routes/tbr.routes"));
app.use("/api/bookings", require("./routes/booking.routes"));
app.use("/api", require("./routes/cancellation.routes")); // Cancellation preview
app.use("/api/disputes", require("./routes/dispute.routes"));
app.use("/api/payments", require("./routes/payment.routes"));
app.use("/api/operators", require("./routes/operator.routes"));
app.use("/api/treks", require("./routes/trek.routes"));

// ========== COUPON & BADGE MANAGEMENT (backend) ==========
app.use("/api/badges", require("./routes/badgeRoutes"));
app.use("/api/coupons", require("./routes/couponRoutes"));
app.use("/api/redemptions", require("./routes/redemptionRoutes"));
app.use("/api/vendor-coupons", require("./routes/vendorCouponRoutes"));
app.use("/api/commission-logs", require("./routes/commissionRoutes"));
app.use("/api/payout-batches", require("./routes/payoutRoutes")); // Payout batches
app.use("/api/payouts", require("./routes/payoutRoutes")); // Vendor payout management
app.use("/api/requests", require("./routes/requests.routes")); // Manual payout requests
app.use("/api/withdrawals", require("./routes/withdrawalRoutes"));
app.use("/api/discount-modes", require("./routes/settingsRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));

// ========== DISCOVERY MANAGER (NEW) ==========
app.use("/api", require("./routes/discoveryRoutes"));

// ========== VENDOR MANAGEMENT (both backends) ==========
app.use("/api/vendors", require("./routes/vendorRoutes"));
app.use("/api/vendor-requests", require("./routes/vendorRequest.routes")); // Using backend_1 version with /pending endpoint

// ========== AUDIT LOGS (both backends) ==========
app.use("/api/audit-logs", require("./routes/auditRoutes")); // Using backend version

/**
 * -------------------
 * 404 Handler
 * -------------------
 */
app.use((req, res) => {
  return sendResponse(
    res,
    {
      success: false,
      data: null,
      message: "Route not found",
      errors: {
        path: `${req.method} ${req.originalUrl}`
      }
    },
    404
  );
});

/**
 * -------------------
 * Global Error Handler
 * -------------------
 */
app.use(errorHandler);

module.exports = app;
