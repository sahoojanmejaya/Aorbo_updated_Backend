const { Vendor, Trek, User } = require('./models');
const { Op } = require('sequelize');

async function testVendorSearchQuery() {
    try {
        console.log('Testing vendor search query...');
        
        const whereConditions = {};
        const search = 'test'; // Simulate search parameter
        
        // Add search conditions like in the controller
        if (search) {
            whereConditions[Op.or] = [
                { business_name: { [Op.like]: `%${search}%` } },
                { '$user.email$': { [Op.like]: `%${search}%` } },
                { '$user.phone$': { [Op.like]: `%${search}%` } }
            ];
        }
        
        const page = 1;
        const limit = 10;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        console.log('Testing findAndCountAll with search...');
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
        
        console.log('✅ Search query works:', count, 'total vendors,', vendors.length, 'returned');
        
    } catch (error) {
        console.log('❌ Error in search query:', error.message);
    }
}

testVendorSearchQuery();