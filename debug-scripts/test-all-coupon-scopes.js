// Test script to see all coupon scopes and types
const axios = require('axios');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkBhb3Jiby5jb20iLCJyb2xlIjoiYWRtaW4iLCJyb2xlSWQiOjEsImlhdCI6MTc3MzY3Njc5MywiZXhwIjoxNzc0MjgxNTkzfQ.QVLncEK03UfZ70SPxC0mfuc1VzfSjp2ermKISNYNLn4';

const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
};

async function testAllCouponScopes() {
    console.log('🔍 Testing all coupon scopes and types...\n');

    try {
        const response = await axios.get('http://localhost:3001/api/admin/coupons', { headers });
        const coupons = response.data.data.coupons;
        
        console.log(`✅ Found ${coupons.length} total coupons\n`);
        
        // Group by scope
        const scopeGroups = {};
        const statusGroups = {};
        
        coupons.forEach(coupon => {
            // Group by scope
            if (!scopeGroups[coupon.scope]) {
                scopeGroups[coupon.scope] = [];
            }
            scopeGroups[coupon.scope].push(coupon);
            
            // Group by status
            if (!statusGroups[coupon.status]) {
                statusGroups[coupon.status] = [];
            }
            statusGroups[coupon.status].push(coupon);
        });
        
        console.log('📊 Coupons by SCOPE:');
        Object.keys(scopeGroups).forEach(scope => {
            console.log(`   ${scope}: ${scopeGroups[scope].length} coupons`);
            scopeGroups[scope].forEach(coupon => {
                console.log(`     - ${coupon.code} (${coupon.status}) - ${coupon.title}`);
            });
        });
        
        console.log('\n📊 Coupons by STATUS:');
        Object.keys(statusGroups).forEach(status => {
            console.log(`   ${status}: ${statusGroups[status].length} coupons`);
        });
        
        console.log('\n🎯 Sample coupons for each scope:');
        Object.keys(scopeGroups).forEach(scope => {
            const sample = scopeGroups[scope][0];
            console.log(`\n${scope} Sample:`, {
                code: sample.code,
                title: sample.title,
                status: sample.status,
                discount_type: sample.discount_type,
                discount_value: sample.discount_value,
                vendor: sample.vendor?.business_name || 'No vendor'
            });
        });
        
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

testAllCouponScopes();