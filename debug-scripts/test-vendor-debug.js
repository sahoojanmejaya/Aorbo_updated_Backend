const { Vendor, Trek, User } = require('./models');
const { Op } = require('sequelize');

async function testVendorDebug() {
    try {
        console.log('Testing vendor query step by step...');
        
        // Test 1: Simple findAndCountAll
        console.log('1. Testing simple findAndCountAll...');
        const result1 = await Vendor.findAndCountAll({
            attributes: ['id', 'business_name', 'status'],
            limit: 5
        });
        console.log('✅ Simple findAndCountAll works:', result1.count);
        
        // Test 2: With User include
        console.log('2. Testing with User include...');
        const result2 = await Vendor.findAndCountAll({
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
        console.log('✅ With User include works:', result2.count);
        
        // Test 3: With Trek include
        console.log('3. Testing with Trek include...');
        const result3 = await Vendor.findAndCountAll({
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
        console.log('✅ With Trek include works:', result3.count);
        
        // Test 4: With both includes
        console.log('4. Testing with both includes...');
        const result4 = await Vendor.findAndCountAll({
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
        console.log('✅ With both includes works:', result4.count);
        
        // Test 5: With all attributes like in controller
        console.log('5. Testing with all attributes...');
        const result5 = await Vendor.findAndCountAll({
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
            limit: 5,
            order: [['created_at', 'DESC']]
        });
        console.log('✅ With all attributes works:', result5.count);
        
    } catch (error) {
        console.log('❌ Error at step:', error.message);
    }
}

testVendorDebug();