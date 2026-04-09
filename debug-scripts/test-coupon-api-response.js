const { Coupon, Vendor, User } = require('./models');
const { Op } = require('sequelize');

async function testCouponApiResponse() {
    try {
        console.log('🧪 Testing coupon API response structure...');
        
        // Simulate the same query as the controller
        const { count, rows: coupons } = await Coupon.findAndCountAll({
            include: [
                {
                    model: Vendor,
                    as: 'vendor',
                    attributes: ['id', 'business_name', 'company_info', 'status'],
                    include: [
                        {
                            model: User,
                            as: 'user',
                            attributes: ['id', 'name', 'email', 'phone']
                        }
                    ]
                }
            ],
            order: [['created_at', 'DESC']],
            limit: 10,
            offset: 0
        });

        console.log(`📊 Found ${count} total coupons, returning ${coupons.length} in this page`);
        
        if (coupons.length > 0) {
            console.log('🎯 Sample coupon structure:');
            const sample = coupons[0].toJSON();
            console.log('- ID:', sample.id);
            console.log('- Code:', sample.code);
            console.log('- Scope:', sample.scope);
            console.log('- Status:', sample.status);
            console.log('- Description:', sample.description);
            console.log('- All fields:', Object.keys(sample));
        }

        // Simulate the exact response structure from controller
        const response = {
            success: true,
            data: {
                coupons,
                pagination: {
                    current_page: 1,
                    total_pages: Math.ceil(count / 10),
                    total_items: count,
                    items_per_page: 10
                }
            }
        };

        console.log('📦 Response structure:');
        console.log('- success:', response.success);
        console.log('- data.coupons length:', response.data.coupons.length);
        console.log('- data.pagination:', response.data.pagination);
        
        console.log('✅ API response structure test completed');
        
    } catch (error) {
        console.error('❌ Error testing coupon API response:', error);
    }
}

// Run the test
testCouponApiResponse().then(() => {
    console.log('🏁 Test completed');
    process.exit(0);
}).catch(err => {
    console.error('💥 Test failed:', err);
    process.exit(1);
});