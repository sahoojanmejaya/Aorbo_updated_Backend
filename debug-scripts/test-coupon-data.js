const { Coupon, Vendor, User } = require("./models");

const testCouponData = async () => {
    try {
        console.log('🔍 Fetching coupon data from database...');
        
        const coupons = await Coupon.findAll({
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
            limit: 5 // Just get first 5 for testing
        });

        console.log(`\n📊 Found ${coupons.length} coupons in database:`);
        
        coupons.forEach((coupon, index) => {
            console.log(`\n${index + 1}. Coupon: ${coupon.code}`);
            console.log(`   - ID: ${coupon.id}`);
            console.log(`   - Status: ${coupon.status}`);
            console.log(`   - Approval Status: ${coupon.approval_status}`);
            console.log(`   - Scope: ${coupon.scope || 'NULL'}`);
            console.log(`   - Mode: ${coupon.mode || 'NULL'}`);
            console.log(`   - Description: ${coupon.description || 'NULL'}`);
            console.log(`   - Created By: ${coupon.created_by || 'NULL'}`);
            console.log(`   - Vendor ID: ${coupon.vendor_id || 'NULL'}`);
        });

        // Check the raw data structure
        if (coupons.length > 0) {
            console.log('\n🔍 Raw first coupon data:');
            console.log(JSON.stringify(coupons[0].toJSON(), null, 2));
        }

    } catch (error) {
        console.error('❌ Error fetching coupon data:', error);
    }
};

testCouponData();