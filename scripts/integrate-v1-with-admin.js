#!/usr/bin/env node

/**
 * Integration Script: Connect V1 (Customer) Routes with Admin Control
 * 
 * This script updates the existing v1 routes to integrate with admin oversight
 * following the controlled aggregator architecture.
 */

const fs = require('fs');
const path = require('path');

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║   V1 Routes → Admin Control Integration Script            ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

let changesApplied = 0;
let warnings = 0;

// Helper function to backup file
function backupFile(filePath) {
    const backupPath = `${filePath}.backup`;
    if (fs.existsSync(filePath)) {
        fs.copyFileSync(filePath, backupPath);
        console.log(`   📦 Backup created: ${path.basename(backupPath)}`);
        return true;
    }
    return false;
}

// Helper function to check if file exists
function fileExists(filePath) {
    return fs.existsSync(filePath);
}

// 1. Update v1/index.js to use secure booking routes
console.log("1️⃣  Updating v1/index.js...");
const v1IndexPath = path.join(__dirname, '../routes/v1/index.js');

if (fileExists(v1IndexPath)) {
    backupFile(v1IndexPath);
    let v1Index = fs.readFileSync(v1IndexPath, 'utf8');
    
    // Check if already updated
    if (v1Index.includes('secureBookingRoutes')) {
        console.log("   ✅ Already using secureBookingRoutes\n");
    } else {
        // Add secure booking routes import
        if (!v1Index.includes('const secureBookingRoutes')) {
            v1Index = v1Index.replace(
                'const chatRoutes = require("./chatRoutes");',
                'const chatRoutes = require("./chatRoutes");\nconst secureBookingRoutes = require("./secureBookingRoutes");'
            );
        }
        
        // Replace old booking routes
        v1Index = v1Index.replace(
            'router.use("/customer/bookings", customerBookingRoutes);',
            '// OLD: router.use("/customer/bookings", customerBookingRoutes);\n// NEW: Using secure 3-step booking flow\nrouter.use("/bookings", secureBookingRoutes);'
        );
        
        fs.writeFileSync(v1IndexPath, v1Index);
        console.log("   ✅ Updated to use secureBookingRoutes");
        changesApplied++;
    }
} else {
    console.log("   ⚠️  File not found: v1/index.js");
    warnings++;
}
console.log();

// 2. Check if secure booking routes exist
console.log("2️⃣  Checking secure booking routes...");
const secureBookingRoutesPath = path.join(__dirname, '../routes/v1/secureBookingRoutes.js');

if (fileExists(secureBookingRoutesPath)) {
    console.log("   ✅ secureBookingRoutes.js exists\n");
} else {
    console.log("   ⚠️  secureBookingRoutes.js not found");
    console.log("   📝 This file should have been created by the main implementation");
    warnings++;
}
console.log();

// 3. Update trek controller to filter approved treks only
console.log("3️⃣  Updating trek controller...");
const trekControllerPath = path.join(__dirname, '../controllers/v1/trekController.js');

if (fileExists(trekControllerPath)) {
    backupFile(trekControllerPath);
    let trekController = fs.readFileSync(trekControllerPath, 'utf8');
    
    // Check if already has approval filter
    if (trekController.includes('approval_status: "approved"')) {
        console.log("   ✅ Already filtering by approval_status\n");
    } else {
        console.log("   ⚠️  Manual update required:");
        console.log("   📝 Add to Trek.findAll where clause:");
        console.log("      approval_status: 'approved',");
        console.log("      visibility: true");
        warnings++;
    }
} else {
    console.log("   ⚠️  File not found: controllers/v1/trekController.js");
    warnings++;
}
console.log();

// 4. Update coupon controller to filter approved coupons
console.log("4️⃣  Updating coupon controller...");
const couponControllerPath = path.join(__dirname, '../controllers/v1/couponController.js');

if (fileExists(couponControllerPath)) {
    backupFile(couponControllerPath);
    let couponController = fs.readFileSync(couponControllerPath, 'utf8');
    
    if (couponController.includes('approval_status: "approved"')) {
        console.log("   ✅ Already filtering by approval_status\n");
    } else {
        console.log("   ⚠️  Manual update required:");
        console.log("   📝 Add to Coupon.findAll where clause:");
        console.log("      approval_status: 'approved'");
        warnings++;
    }
} else {
    console.log("   ⚠️  File not found: controllers/v1/couponController.js");
    warnings++;
}
console.log();

// 5. Check chat routes for direct contact prevention
console.log("5️⃣  Checking chat routes...");
const chatRoutesPath = path.join(__dirname, '../routes/v1/chatRoutes.js');

if (fileExists(chatRoutesPath)) {
    let chatRoutes = fs.readFileSync(chatRoutesPath, 'utf8');
    
    if (chatRoutes.includes('preventDirectContact')) {
        console.log("   ✅ Already has preventDirectContact middleware\n");
    } else {
        console.log("   ⚠️  Manual update required:");
        console.log("   📝 Add preventDirectContact middleware to chat routes");
        console.log("   📝 Import from: middleware/securityMiddleware");
        warnings++;
    }
} else {
    console.log("   ⚠️  File not found: routes/v1/chatRoutes.js");
    warnings++;
}
console.log();

// 6. Check if security middleware exists
console.log("6️⃣  Checking security middleware...");
const securityMiddlewarePath = path.join(__dirname, '../middleware/securityMiddleware.js');

if (fileExists(securityMiddlewarePath)) {
    console.log("   ✅ securityMiddleware.js exists\n");
} else {
    console.log("   ⚠️  securityMiddleware.js not found");
    console.log("   📝 This file should have been created by the main implementation");
    warnings++;
}
console.log();

// 7. Check if services exist
console.log("7️⃣  Checking core services...");
const services = [
    'fareCalculationService.js',
    'paymentService.js',
    'notificationService.js',
    'cancellationService.js'
];

services.forEach(service => {
    const servicePath = path.join(__dirname, '../services', service);
    if (fileExists(servicePath)) {
        console.log(`   ✅ ${service} exists`);
    } else {
        console.log(`   ⚠️  ${service} not found`);
        warnings++;
    }
});
console.log();

// 8. Generate integration report
console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║                   INTEGRATION REPORT                       ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

console.log(`✅ Changes Applied: ${changesApplied}`);
console.log(`⚠️  Warnings: ${warnings}\n`);

if (warnings > 0) {
    console.log("⚠️  MANUAL ACTIONS REQUIRED:\n");
    console.log("1. Update trek controller to filter approved treks:");
    console.log("   File: controllers/v1/trekController.js");
    console.log("   Add: approval_status: 'approved', visibility: true\n");
    
    console.log("2. Update coupon controller to filter approved coupons:");
    console.log("   File: controllers/v1/couponController.js");
    console.log("   Add: approval_status: 'approved'\n");
    
    console.log("3. Add preventDirectContact to chat routes:");
    console.log("   File: routes/v1/chatRoutes.js");
    console.log("   Import: const { preventDirectContact } = require('../../middleware/securityMiddleware');\n");
    
    console.log("4. Ensure all core services are created:");
    console.log("   - fareCalculationService.js");
    console.log("   - paymentService.js");
    console.log("   - notificationService.js");
    console.log("   - cancellationService.js\n");
}

console.log("📚 DOCUMENTATION:");
console.log("   - ARCHITECTURE.md - Complete system design");
console.log("   - IMPLEMENTATION_GUIDE.md - Step-by-step setup");
console.log("   - ADMIN_CUSTOMER_INTEGRATION.md - V1 integration details");
console.log("   - SYSTEM_SUMMARY.md - Quick reference\n");

console.log("🧪 TESTING:");
console.log("   Run these tests after manual updates:");
console.log("   1. Test trek listing (only approved treks)");
console.log("   2. Test booking flow (3-step secure flow)");
console.log("   3. Test coupon validation (only approved coupons)");
console.log("   4. Test chat routing (through admin only)\n");

console.log("🔄 ROLLBACK:");
console.log("   If needed, restore from .backup files created in this run\n");

if (changesApplied > 0) {
    console.log("✅ Integration script completed successfully!");
} else if (warnings === 0) {
    console.log("✅ All checks passed - system already integrated!");
} else {
    console.log("⚠️  Integration incomplete - manual actions required");
}

console.log("\n╔════════════════════════════════════════════════════════════╗");
console.log("║              Integration Script Complete                   ║");
console.log("╚════════════════════════════════════════════════════════════╝");
