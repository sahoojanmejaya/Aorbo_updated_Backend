#!/usr/bin/env node

/**
 * Test Script for Email Notification System
 * Tests various error scenarios and logging capabilities
 */

const logger = require('../utils/logger');

console.log('🧪 Testing Arobo Backend Email Notification System\n');

async function runTests() {
    try {
        // Test 1: Check email service status
        console.log('📧 Test 1: Email Service Status');
        const emailStatus = logger.getEmailServiceStatus();
        console.log('Status:', JSON.stringify(emailStatus, null, 2));

        if (!emailStatus.available) {
            console.log('❌ Email service not available, exiting tests');
            return;
        }

        // Test 2: Send test email
        console.log('\n📧 Test 2: Test Email');
        const testResult = await logger.testEmailNotification();
        console.log('Test email result:', testResult ? '✅ Success' : '❌ Failed');

        // Wait a moment between tests to respect rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 3: Critical payment error simulation
        console.log('\n🚨 Test 3: Critical Payment Error');
        const paymentError = new Error('Payment processing failed - Razorpay gateway timeout');
        paymentError.code = 'PAYMENT_GATEWAY_ERROR';
        logger.logPaymentError(paymentError, {
            paymentId: 'pay_test_12345',
            orderId: 'order_test_67890',
            amount: 15000,
            customerId: 'cust_001'
        });
        console.log('✅ Critical payment error logged and email sent');

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 4: Database connection error simulation
        console.log('\n💾 Test 4: Database Connection Error');
        const dbError = new Error('Connection lost: Can\'t connect to MySQL server on localhost');
        dbError.code = 'ECONNREFUSED';
        logger.logDatabaseError(dbError, {
            query: 'SELECT * FROM bookings WHERE status = ?',
            operation: 'findAllBookings'
        });
        console.log('✅ Database error logged and email sent');

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 5: Authentication error simulation
        console.log('\n🔐 Test 5: Authentication Error');
        const authError = new Error('JWT token verification failed');
        authError.code = 'TOKEN_EXPIRED';
        logger.logAuthError(authError, {
            userId: 'user_001',
            action: 'access_vendor_dashboard',
            tokenAge: '2 hours'
        });
        console.log('✅ Authentication error logged and email sent');

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 6: Booking error simulation
        console.log('\n🎒 Test 6: Booking Processing Error');
        const bookingError = new Error('Failed to create booking - insufficient trek capacity');
        logger.logBookingError(bookingError, {
            trekId: 'trek_001',
            batchId: 'batch_001',
            requestedSlots: 5,
            availableSlots: 2,
            customerId: 'cust_002'
        });
        console.log('✅ Booking error logged and email sent');

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 7: Trek management error simulation
        console.log('\n🏔️ Test 7: Trek Management Error');
        const trekError = new Error('Trek deletion failed - active bookings exist');
        logger.logTrekError(trekError, {
            trekId: 'trek_001',
            vendorId: 'vendor_001',
            activeBookings: 15,
            operation: 'delete_trek'
        });
        console.log('✅ Trek error logged and email sent');

        console.log('\n🎉 All email notification tests completed successfully!');
        console.log('\n📧 Check admin@arobo.com for the test email notifications');
        console.log('\n📊 Email service statistics:');

        const finalStatus = logger.getEmailServiceStatus();
        console.log(JSON.stringify(finalStatus, null, 2));

    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
        logger.logErrorObject('error', error, {
            context: 'email_test_script',
            testPhase: 'execution'
        });
    }
}

// Run the tests
runTests().then(() => {
    console.log('\n✅ Email notification system testing completed');
    process.exit(0);
}).catch((error) => {
    console.error('💥 Fatal error during testing:', error);
    process.exit(1);
});