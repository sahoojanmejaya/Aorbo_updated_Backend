// Test script to see actual coupon data structure
const axios = require('axios');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkBhb3Jiby5jb20iLCJyb2xlIjoiYWRtaW4iLCJyb2xlSWQiOjEsImlhdCI6MTc3MzY3Njc5MywiZXhwIjoxNzc0MjgxNTkzfQ.QVLncEK03UfZ70SPxC0mfuc1VzfSjp2ermKISNYNLn4';

const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
};

async function testCouponStructure() {
    console.log('🔍 Testing actual coupon data structure...\n');

    try {
        const response = await axios.get('http://localhost:3001/api/admin/coupons', { headers });
        console.log('✅ API Response Structure:');
        console.log('   - success:', response.data.success);
        console.log('   - data.coupons is array:', Array.isArray(response.data.data.coupons));
        console.log('   - coupons count:', response.data.data.coupons.length);
        
        if (response.data.data.coupons.length > 0) {
            const firstCoupon = response.data.data.coupons[0];
            console.log('\n📦 First Coupon Structure:');
            console.log('   - id:', firstCoupon.id);
            console.log('   - code:', firstCoupon.code);
            console.log('   - title:', firstCoupon.title);
            console.log('   - scope:', firstCoupon.scope);
            console.log('   - status:', firstCoupon.status);
            console.log('   - discount_type:', firstCoupon.discount_type);
            console.log('   - discount_value:', firstCoupon.discount_value);
            console.log('   - valid_from:', firstCoupon.valid_from);
            console.log('   - valid_until:', firstCoupon.valid_until);
            console.log('   - config:', firstCoupon.config);
            console.log('   - created_at:', firstCoupon.created_at);
            console.log('   - updated_at:', firstCoupon.updated_at);
            
            console.log('\n🔧 All Fields:');
            console.log(Object.keys(firstCoupon));
            
            console.log('\n📋 Full First Coupon:');
            console.log(JSON.stringify(firstCoupon, null, 2));
        }
        
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

testCouponStructure();