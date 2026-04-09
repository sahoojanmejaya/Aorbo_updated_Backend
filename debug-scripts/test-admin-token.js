const jwt = require('jsonwebtoken');
require('dotenv').config();

// Generate admin token for testing
const generateAdminToken = () => {
    const payload = {
        id: 1,
        email: 'admin@aorbo.com',
        role: 'admin',
        roleId: 1,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET);
    console.log('🔑 Admin Token Generated:');
    console.log(token);
    console.log('\n📋 Copy this token to test the API');
    console.log('\n🧪 Test with:');
    console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:3001/api/admin/coupons`);
    
    return token;
};

// Test the admin login endpoint
const testAdminLogin = async () => {
    try {
        const response = await fetch('http://localhost:3001/api/admin/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'admin@aorbo.com',
                password: 'admin123'
            })
        });

        const result = await response.json();
        console.log('\n🔐 Admin Login Test:');
        console.log('Status:', response.status);
        console.log('Response:', result);

        if (result.success && result.data.token) {
            console.log('\n✅ Login successful! Token:', result.data.token.substring(0, 50) + '...');
            return result.data.token;
        } else {
            console.log('\n❌ Login failed');
            return null;
        }
    } catch (error) {
        console.error('\n❌ Login test error:', error.message);
        return null;
    }
};

// Test coupons API with token
const testCouponsAPI = async (token) => {
    try {
        const response = await fetch('http://localhost:3001/api/admin/coupons', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();
        console.log('\n🎫 Coupons API Test:');
        console.log('Status:', response.status);
        console.log('Response:', result);

        if (result.success) {
            console.log(`✅ Found ${result.data.coupons.length} coupons`);
        } else {
            console.log('❌ API call failed');
        }
    } catch (error) {
        console.error('\n❌ Coupons API test error:', error.message);
    }
};

// Run all tests
const runTests = async () => {
    console.log('🚀 Starting Admin API Tests...\n');
    
    // Test 1: Generate token manually
    console.log('=== Test 1: Manual Token Generation ===');
    const manualToken = generateAdminToken();
    
    // Test 2: Login endpoint
    console.log('\n=== Test 2: Admin Login Endpoint ===');
    const loginToken = await testAdminLogin();
    
    // Test 3: Use token to test coupons API
    const tokenToUse = loginToken || manualToken;
    if (tokenToUse) {
        console.log('\n=== Test 3: Coupons API with Token ===');
        await testCouponsAPI(tokenToUse);
    }
    
    console.log('\n🏁 Tests completed!');
};

// Run if called directly
if (require.main === module) {
    runTests();
}

module.exports = { generateAdminToken, testAdminLogin, testCouponsAPI };