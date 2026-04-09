#!/usr/bin/env node

/**
 * V1-Admin Connection Verification Script
 * 
 * This script verifies that V1 routes are properly connected with admin control
 */

const fs = require('fs');
const path = require('path');

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║   V1 ↔ Admin Connection Verification                      ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

let passed = 0;
let failed = 0;

// Helper to check if file contains text
function fileContains(filePath, searchText) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return content.includes(searchText);
    } catch (error) {
        return false;
    }
}

// Helper to check if file exists
function fileExists(filePath) {
    return fs.existsSync(filePath);
}

console.log("🔍 Checking V1 Trek Controller...\n");

// Test 1: Trek controller has approval_status filter
const trekControllerPath = path.join(__dirname, '../controllers/v1/trekController.js');
if (fileContains(trekControllerPath, 'approval_status: "approved"')) {
    console.log("✅ PASS: Trek controller filters by approval_status");
    passed++;
} else {
    console.log("❌ FAIL: Trek controller missing approval_status filter");
    failed++;
}

// Test 2: Trek controller has visibility filter
if (fileContains(trekControllerPath, 'visibility: true')) {
    console.log("✅ PASS: Trek controller filters by visibility");
    passed++;
} else {
    console.log("❌ FAIL: Trek controller missing visibility filter");
    failed++;
}

console.log("\n🔍 Checking V1 Coupon Controller...\n");

// Test 3: Coupon controller has approval_status filter
const couponControllerPath = path.join(__dirname, '../controllers/v1/couponController.js');
if (fileContains(couponControllerPath, 'approval_status: "approved"')) {
    console.log("✅ PASS: Coupon controller filters by approval_status");
    passed++;
} else {
    console.log("❌ FAIL: Coupon controller missing approval_status filter");
    failed++;
}

console.log("\n🔍 Checking V1 Chat Routes...\n");

// Test 4: Chat routes have preventDirectContact middleware
const chatRoutesPath = path.join(__dirname, '../routes/v1/chatRoutes.js');
if (fileContains(chatRoutesPath, 'preventDirectContact')) {
    console.log("✅ PASS: Chat routes use preventDirectContact middleware");
    passed++;
} else {
    console.log("❌ FAIL: Chat routes missing preventDirectContact middleware");
    failed++;
}

console.log("\n🔍 Checking V1 Index Routes...\n");

// Test 5: V1 index uses secureBookingRoutes
const v1IndexPath = path.join(__dirname, '../routes/v1/index.js');
if (fileContains(v1IndexPath, 'secureBookingRoutes')) {
    console.log("✅ PASS: V1 index uses secureBookingRoutes");
    passed++;
} else {
    console.log("❌ FAIL: V1 index not using secureBookingRoutes");
    failed++;
}

// Test 6: V1 index doesn't use old customerBookingRoutes
if (!fileContains(v1IndexPath, 'const customerBookingRoutes = require')) {
    console.log("✅ PASS: Old customerBookingRoutes removed");
    passed++;
} else {
    console.log("❌ FAIL: Old customerBookingRoutes still imported");
    failed++;
}

console.log("\n🔍 Checking Required Files...\n");

// Test 7: Security middleware exists
const securityMiddlewarePath = path.join(__dirname, '../middleware/securityMiddleware.js');
if (fileExists(securityMiddlewarePath)) {
    console.log("✅ PASS: Security middleware exists");
    passed++;
} else {
    console.log("❌ FAIL: Security middleware missing");
    failed++;
}

// Test 8: Fare calculation service exists
const fareServicePath = path.join(__dirname, '../services/fareCalculationService.js');
if (fileExists(fareServicePath)) {
    console.log("✅ PASS: Fare calculation service exists");
    passed++;
} else {
    console.log("❌ FAIL: Fare calculation service missing");
    failed++;
}

// Test 9: Payment service exists
const paymentServicePath = path.join(__dirname, '../services/paymentService.js');
if (fileExists(paymentServicePath)) {
    console.log("✅ PASS: Payment service exists");
    passed++;
} else {
    console.log("❌ FAIL: Payment service missing");
    failed++;
}

// Test 10: Secure booking routes exist
const secureBookingRoutesPath = path.join(__dirname, '../routes/v1/secureBookingRoutes.js');
if (fileExists(secureBookingRoutesPath)) {
    console.log("✅ PASS: Secure booking routes exist");
    passed++;
} else {
    console.log("❌ FAIL: Secure booking routes missing");
    failed++;
}

console.log("\n╔════════════════════════════════════════════════════════════╗");
console.log("║                   VERIFICATION RESULTS                     ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

console.log(`✅ Passed: ${passed}/10`);
console.log(`❌ Failed: ${failed}/10\n`);

if (failed === 0) {
    console.log("🎉 SUCCESS: V1 is properly connected with Admin control!\n");
    console.log("✅ Trek visibility controlled by admin approval");
    console.log("✅ Coupon validation controlled by admin approval");
    console.log("✅ Communication routed through admin");
    console.log("✅ Booking flow uses secure 3-step process");
    console.log("✅ All required services and middleware in place\n");
    
    console.log("📋 NEXT STEPS:");
    console.log("1. Test trek listing (should show only approved treks)");
    console.log("2. Test booking flow (3-step secure process)");
    console.log("3. Test chat (should block direct vendor contact)");
    console.log("4. Update mobile app to use new booking endpoints\n");
    
    process.exit(0);
} else {
    console.log("⚠️  INCOMPLETE: Some V1-Admin connections are missing\n");
    console.log("📋 REQUIRED ACTIONS:");
    
    if (!fileContains(trekControllerPath, 'approval_status: "approved"')) {
        console.log("- Add approval_status filter to trek controller");
    }
    if (!fileContains(trekControllerPath, 'visibility: true')) {
        console.log("- Add visibility filter to trek controller");
    }
    if (!fileContains(couponControllerPath, 'approval_status: "approved"')) {
        console.log("- Add approval_status filter to coupon controller");
    }
    if (!fileContains(chatRoutesPath, 'preventDirectContact')) {
        console.log("- Add preventDirectContact middleware to chat routes");
    }
    if (!fileContains(v1IndexPath, 'secureBookingRoutes')) {
        console.log("- Replace customerBookingRoutes with secureBookingRoutes");
    }
    if (!fileExists(securityMiddlewarePath)) {
        console.log("- Create security middleware file");
    }
    if (!fileExists(fareServicePath)) {
        console.log("- Create fare calculation service");
    }
    if (!fileExists(paymentServicePath)) {
        console.log("- Create payment service");
    }
    if (!fileExists(secureBookingRoutesPath)) {
        console.log("- Create secure booking routes");
    }
    
    console.log("\n📚 See V1_ADMIN_CONNECTION_COMPLETED.md for details\n");
    
    process.exit(1);
}
