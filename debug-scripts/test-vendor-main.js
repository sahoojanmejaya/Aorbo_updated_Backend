const { Vendor, Trek, User } = require('./models');
const { Op } = require('sequelize');

async function testMainVendorQuery() {
    try {
        console.log('Testing main vendor query...');
        
        const whereConditions = {};
        const page = 1;
        const limit = 10;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        console.log('Testing findAndCountAll query...');
        const { count, rows: vendors } = await Vendor.findAndCountAll({
            where: whereConditions,
            attributes: [
                'id', 'business_name', 'business_address', 'gstin', 'pan_no', 'status',
                'kyc_status', 'created_at', 'updated_at'
            ],
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'phone'],
                    required: false
                },
                {
                    model: Trek,
                    as: 'treks',
                    attributes: ['id', 'title', 'status'],
                    required: false
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['created_at', 'DESC']]
        });
        
        console.log('✅ Main query works:', count, 'total vendors,', vendors.length, 'returned');
        
    } catch (error) {
        console.log('❌ Error in main query:', error.message);
    }
}

testMainVendorQuery();