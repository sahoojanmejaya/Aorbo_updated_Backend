const axios = require('axios');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkB0ZXN0LmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc3MzY3MTM5NCwiZXhwIjoxNzczNjc0OTk0fQ.wbxj6z1_PI20DONxx61zpD-F4vVyca16bBbbqiEzBs0';

const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
};

async function testEndpoints() {
    console.log('Testing redemptions endpoint...');
    try {
        const response = await axios.get('http://localhost:3001/api/admin/redemptions', { headers });
        console.log('✅ Redemptions success:', response.data);
    } catch (error) {
        console.log('❌ Redemptions error:', error.response?.data || error.message);
    }

    console.log('\nTesting vendors endpoint...');
    try {
        const response = await axios.get('http://localhost:3001/api/admin/vendors', { headers });
        console.log('✅ Vendors success:', response.data);
    } catch (error) {
        console.log('❌ Vendors error:', error.response?.data || error.message);
    }

    console.log('\nTesting coupons endpoint...');
    try {
        const response = await axios.get('http://localhost:3001/api/admin/coupons', { headers });
        console.log('✅ Coupons success:', response.data.success ? 'Working' : 'Failed');
        console.log('Coupons data type:', Array.isArray(response.data.data?.coupons) ? 'Array' : 'Not Array');
    } catch (error) {
        console.log('❌ Coupons error:', error.response?.data || error.message);
    }
}

testEndpoints();