const { Vendor, Trek, Booking, User } = require('./models');

async function testVendorStats() {
    try {
        console.log('Testing vendor statistics queries...');
        
        // Get a vendor first
        const vendor = await Vendor.findOne();
        if (!vendor) {
            console.log('No vendors found in database');
            return;
        }
        
        console.log('Testing vendor found:', vendor.id, vendor.business_name);
        
        console.log('Testing trek count query...');
        const trekCount = await Trek.count({ where: { vendor_id: vendor.id } });
        console.log('✅ Trek count works:', trekCount);
        
        console.log('Testing booking stats query...');
        const bookingStats = await Booking.findAll({
            attributes: [
                [require('sequelize').fn('COUNT', require('sequelize').col('Booking.id')), 'booking_count'],
                [require('sequelize').fn('SUM', require('sequelize').col('Booking.total_amount')), 'total_revenue']
            ],
            include: [
                {
                    model: Trek,
                    as: 'trek',
                    where: { vendor_id: vendor.id },
                    attributes: []
                }
            ],
            raw: true
        });
        
        console.log('✅ Booking stats works:', bookingStats);
        
    } catch (error) {
        console.log('❌ Error in stats:', error.message);
    }
}

testVendorStats();