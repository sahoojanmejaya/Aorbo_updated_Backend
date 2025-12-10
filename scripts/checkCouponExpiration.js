const { Coupon } = require('../models');
const CouponAuditService = require('../services/couponAuditService');

/**
 * Check for expired coupons and update their status
 * This script should be run periodically (e.g., daily via cron job)
 */
async function checkCouponExpiration() {
    try {
        console.log('Starting coupon expiration check...');
        
        const currentDate = new Date();
        
        // Find coupons that should be expired
        const expiredCoupons = await Coupon.findAll({
            where: {
                status: 'active',
                approval_status: 'approved',
                valid_until: {
                    [require('sequelize').Op.lt]: currentDate
                }
            }
        });

        console.log(`Found ${expiredCoupons.length} expired coupons`);

        // Update each expired coupon
        for (const coupon of expiredCoupons) {
            try {
                // Update coupon status to expired
                await coupon.update({ status: 'expired' });
                
                // Log the expiration
                await CouponAuditService.logCouponExpiration(coupon, coupon.vendor_id);
                
                console.log(`Coupon ${coupon.code} (ID: ${coupon.id}) marked as expired`);
            } catch (error) {
                console.error(`Error processing coupon ${coupon.id}:`, error);
            }
        }

        console.log('Coupon expiration check completed');
        return {
            success: true,
            expiredCount: expiredCoupons.length,
            message: `Processed ${expiredCoupons.length} expired coupons`
        };
    } catch (error) {
        console.error('Error in coupon expiration check:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Run the check if this script is executed directly
if (require.main === module) {
    checkCouponExpiration()
        .then(result => {
            console.log('Result:', result);
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = checkCouponExpiration;



