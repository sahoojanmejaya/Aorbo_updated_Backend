// Test calling the controller function directly
const vendorController = require('./controllers/admin/vendorController');

// Mock request and response objects
const mockReq = {
    query: {
        page: 1,
        limit: 5
    },
    user: {
        id: 1
    }
};

const mockRes = {
    json: (data) => {
        console.log('✅ Controller response:', data.success ? 'Success' : 'Failed');
        if (!data.success) {
            console.log('Error:', data.error);
        }
    },
    status: (code) => ({
        json: (data) => {
            console.log('❌ Controller error:', code, data);
        }
    })
};

async function testDirectController() {
    console.log('Testing vendor controller directly...');
    try {
        await vendorController.getVendors(mockReq, mockRes);
    } catch (error) {
        console.log('❌ Direct controller error:', error.message);
    }
}

testDirectController();