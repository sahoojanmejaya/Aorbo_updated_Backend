const fetch = require('node-fetch');

async function testCouponAPI() {
    try {
        console.log('🧪 Testing coupon API endpoint...');
        
        const response = await fetch('http://localhost:3001/api/admin/coupons', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-admin-token'
            }
        });

        console.log('📊 Response status:', response.status);
        console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error:', errorText);
            return;
        }

        const data = await response.json();
        console.log('📦 Response structure:');
        console.log('- success:', data.success);
        console.log('- data keys:', Object.keys(data.data || {}));
        
        if (data.data && data.data.coupons) {
            console.log('- coupons count:', data.data.coupons.length);
            if (data.data.coupons.length > 0) {
                const sample = data.data.coupons[0];
                console.log('- sample coupon:', {
                    id: sample.id,
                    code: sample.code,
                    scope: sample.scope,
                    status: sample.status,
                    description: sample.description
                });
            }
        }

        console.log('✅ API test completed successfully');
        
    } catch (error) {
        console.error('❌ API test failed:', error.message);
    }
}

testCouponAPI();