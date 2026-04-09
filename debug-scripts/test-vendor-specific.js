const axios = require('axios');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkB0ZXN0LmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc3MzY3MTM5NCwiZXhwIjoxNzczNjc0OTk0fQ.wbxj6z1_PI20DONxx61zpD-F4vVyca16bBbbqiEzBs0';

const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
};

async function testSpecificEndpoint() {
    console.log('Testing vendors endpoint with minimal params...');
    try {
        const response = await axios.get('http://localhost:3001/api/admin/vendors?page=1&limit=5', { headers });
        console.log('✅ Vendors success:', response.data.success);
    } catch (error) {
        console.log('❌ Vendors error:', error.response?.data || error.message);
        console.log('Status:', error.response?.status);
        console.log('Headers:', error.response?.headers);
    }
}

testSpecificEndpoint();