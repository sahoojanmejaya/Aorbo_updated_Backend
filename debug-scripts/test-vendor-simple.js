const { Vendor, Trek, User } = require('./models');

async function testVendorQuery() {
    try {
        console.log('Testing simple vendor query...');
        
        const vendors = await Vendor.findAll({
            attributes: ['id', 'business_name', 'status'],
            limit: 5
        });
        
        console.log('✅ Simple query works:', vendors.length, 'vendors found');
        
        console.log('Testing vendor query with Trek include...');
        const vendorsWithTreks = await Vendor.findAll({
            attributes: ['id', 'business_name', 'status'],
            include: [
                {
                    model: Trek,
                    as: 'treks',
                    attributes: ['id', 'title', 'status'],
                    required: false
                }
            ],
            limit: 5
        });
        
        console.log('✅ Query with Trek include works:', vendorsWithTreks.length, 'vendors found');
        
        console.log('Testing vendor query with User include...');
        const vendorsWithUsers = await Vendor.findAll({
            attributes: ['id', 'business_name', 'status'],
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email'],
                    required: false
                }
            ],
            limit: 5
        });
        
        console.log('✅ Query with User include works:', vendorsWithUsers.length, 'vendors found');
        
        console.log('Testing vendor query with both includes...');
        const vendorsWithBoth = await Vendor.findAll({
            attributes: ['id', 'business_name', 'status'],
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email'],
                    required: false
                },
                {
                    model: Trek,
                    as: 'treks',
                    attributes: ['id', 'title', 'status'],
                    required: false
                }
            ],
            limit: 5
        });
        
        console.log('✅ Query with both includes works:', vendorsWithBoth.length, 'vendors found');
        
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

testVendorQuery();