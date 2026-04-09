require("dotenv").config();

const app = require("./app");

const PORT = process.env.PORT || 5000;

/**
 * -------------------
 * Start Server
 * -------------------
 */
app.listen(PORT, () => {
  console.log('=====================================================');
  console.log('🚀 UNIFIED BACKEND SERVER');
  console.log('=====================================================');
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`💚 Health: http://localhost:${PORT}/health`);
  console.log('=====================================================');
  console.log('📦 Active Modules:');
  console.log('   ✓ Booking & Trek Management');
  console.log('   ✓ Coupon & Badge System');
  console.log('   ✓ Vendor Operations');
  console.log('   ✓ Finance & Tax Compliance');
  console.log('   ✓ Payment & Dispute Management');
  console.log('=====================================================');
  console.log('📚 API Endpoints:');
  console.log('   /api/bookings, /api/tbrs');
  console.log('   /api/coupons, /api/badges');
  console.log('   /api/vendors, /api/operators');
  console.log('   /api/treks, /api/payments');
  console.log('   /api/dashboard, /api/audit-logs');
  console.log('=====================================================');
});
