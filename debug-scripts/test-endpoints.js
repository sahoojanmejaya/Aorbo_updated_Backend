/**
 * Test Script for API Endpoints
 * 
 * @description Tests the fixed API endpoints to verify they're working
 * @author Kiro AI Assistant
 * @created 2026-03-16 19:14:00 IST
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Test endpoints without authentication (should return 401)
async function testEndpoints() {
    console.log('🧪 Testing API Endpoints...\n');
    
    const endpoints = [
        '/api/admin/redemptions',
        '/api/admin/vendors',
        '/api/admin/vendor-requests',
        '/api/admin/commission-logs',
        '/api/admin/withdrawals'
    ];
    
    for (const endpoint of endpoints) {
        try {
            console.log(`Testing: ${endpoint}`);
            const response = await axios.get(`${BASE_URL}${endpoint}`);
            console.log(`✅ ${endpoint}: ${response.status} - ${response.statusText}`);
        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                const message = error.response.data?.message || error.response.statusText;
                
                if (status === 401) {
                    console.log(`✅ ${endpoint}: ${status} - ${message} (Expected - Auth required)`);
                } else if (status === 500) {
                    console.log(`❌ ${endpoint}: ${status} - ${message} (Server Error)`);
                    console.log(`   Error details:`, error.response.data);
                } else {
                    console.log(`⚠️  ${endpoint}: ${status} - ${message}`);
                }
            } else {
                console.log(`❌ ${endpoint}: Connection Error - ${error.message}`);
            }
        }
        console.log('');
    }
    
    console.log('🎉 Endpoint testing completed!');
}

// Run the test
testEndpoints().catch(console.error);