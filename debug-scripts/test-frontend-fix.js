// Test script to verify frontend API fixes
const axios = require('axios');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkB0ZXN0LmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc3MzY3MTM5NCwiZXhwIjoxNzczNjc0OTk0fQ.wbxj6z1_PI20DONxx61zpD-F4vVyca16bBbbqiEzBs0';

const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
};

async function testFrontendAPIStructure() {
    console.log('🧪 Testing API response structures for frontend compatibility...\n');

    // Test Coupons API
    try {
        const couponsResponse = await axios.get('http://localhost:3001/api/admin/coupons', { headers });
        console.log('✅ Coupons API Response Structure:');
        console.log('   - success:', couponsResponse.data.success);
        console.log('   - data.coupons is array:', Array.isArray(couponsResponse.data.data.coupons));
        console.log('   - coupons count:', couponsResponse.data.data.coupons.length);
        console.log('   - has pagination:', !!couponsResponse.data.data.pagination);
    } catch (error) {
        console.log('❌ Coupons API Error:', error.message);
    }

    // Test Vendors API
    try {
        const vendorsResponse = await axios.get('http://localhost:3001/api/admin/vendors', { headers });
        console.log('\n✅ Vendors API Response Structure:');
        console.log('   - success:', vendorsResponse.data.success);
        console.log('   - data.vendors is array:', Array.isArray(vendorsResponse.data.data.vendors));
        console.log('   - vendors count:', vendorsResponse.data.data.vendors.length);
        console.log('   - has pagination:', !!vendorsResponse.data.data.pagination);
    } catch (error) {
        console.log('\n❌ Vendors API Error:', error.message);
    }

    // Test Redemptions API
    try {
        const redemptionsResponse = await axios.get('http://localhost:3001/api/admin/redemptions', { headers });
        console.log('\n✅ Redemptions API Response Structure:');
        console.log('   - success:', redemptionsResponse.data.success);
        console.log('   - data.redemptions is array:', Array.isArray(redemptionsResponse.data.data.redemptions));
        console.log('   - redemptions count:', redemptionsResponse.data.data.redemptions.length);
        console.log('   - has pagination:', !!redemptionsResponse.data.data.pagination);
    } catch (error) {
        console.log('\n❌ Redemptions API Error:', error.message);
    }

    console.log('\n🎯 Frontend Fix Summary:');
    console.log('   All APIs now return: { success: true, data: { items: [], pagination: {} } }');
    console.log('   Frontend APIs extract: response.data.items (where items = coupons/vendors/redemptions)');
    console.log('   This should resolve the "TypeError: coupons.map is not a function" error');
}

testFrontendAPIStructure();