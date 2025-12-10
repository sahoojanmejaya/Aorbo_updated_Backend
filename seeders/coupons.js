"use strict";

const { Coupon, Vendor } = require("../models");

const seedCoupons = async () => {
    try {
        // Check if coupons already exist
        const existingCoupons = await Coupon.findAll();
        if (existingCoupons.length > 0) {
            console.log("Coupons already exist, skipping seed.");
            return;
        }

        // Get all vendors to assign coupons to them
        const vendors = await Vendor.findAll();
        if (vendors.length === 0) {
            console.log("No vendors found. Please run vendors seeder first.");
            return;
        }

        const coupons = [
            // Flat discount coupons
            {
                title: "Early Bird Special",
                vendor_id: vendors[0].id, // Himalayan Adventures
                color: "#10B981",
                code: "EARLY20",
                description: "Get ₹200 off on early bookings",
                discount_type: "flat",
                discount_value: 200.00,
                min_amount: 1000.00,
                max_uses: 100,
                current_uses: 0,
                valid_from: new Date(),
                valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                status: "active",
            },
            {
                title: "Weekend Warrior",
                vendor_id: vendors[0].id,
                color: "#F59E0B",
                code: "WEEKEND50",
                description: "Flat ₹500 off on weekend treks",
                discount_type: "flat",
                discount_value: 500.00,
                min_amount: 2000.00,
                max_uses: 50,
                current_uses: 0,
                valid_from: new Date(),
                valid_until: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
                status: "active",
            },
            {
                title: "First Time Explorer",
                vendor_id: vendors[1].id, // Mountain Trails
                color: "#3B82F6",
                code: "FIRST300",
                description: "Welcome discount for new adventurers",
                discount_type: "flat",
                discount_value: 300.00,
                min_amount: 1500.00,
                max_uses: 200,
                current_uses: 0,
                valid_from: new Date(),
                valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
                status: "active",
            },

            // Percentage discount coupons
            {
                title: "Summer Sale",
                vendor_id: vendors[1].id,
                color: "#EF4444",
                code: "SUMMER15",
                description: "15% off on all summer treks",
                discount_type: "percent",
                discount_value: 15.00,
                min_amount: 1000.00,
                max_discount_amount: 1000.00,
                max_uses: 150,
                current_uses: 0,
                valid_from: new Date(),
                valid_until: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
                status: "active",
            },
            {
                title: "Group Adventure",
                vendor_id: vendors[2].id, // Adventure Zone
                color: "#8B5CF6",
                code: "GROUP20",
                description: "20% off for groups of 4 or more",
                discount_type: "percent",
                discount_value: 20.00,
                min_amount: 2000.00,
                max_discount_amount: 2000.00,
                max_uses: 75,
                current_uses: 0,
                valid_from: new Date(),
                valid_until: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000), // 120 days from now
                status: "active",
            },
            {
                title: "Loyalty Reward",
                vendor_id: vendors[2].id,
                color: "#06B6D4",
                code: "LOYAL10",
                description: "10% off for returning customers",
                discount_type: "percent",
                discount_value: 10.00,
                min_amount: 500.00,
                max_discount_amount: 500.00,
                max_uses: 300,
                current_uses: 0,
                valid_from: new Date(),
                valid_until: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days from now
                status: "active",
            },

            // Conditional discount coupons
            {
                title: "High Altitude Special",
                vendor_id: vendors[3].id, // Ladakh Expeditions
                color: "#F97316",
                code: "ALTITUDE25",
                description: "25% off on treks above 4000m altitude",
                discount_type: "conditional",
                discount_value: 25.00,
                min_amount: 3000.00,
                max_discount_amount: 1500.00,
                max_uses: 40,
                current_uses: 0,
                valid_from: new Date(),
                valid_until: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000), // 100 days from now
                status: "active",
            },
            {
                title: "Monsoon Trekker",
                vendor_id: vendors[3].id,
                color: "#84CC16",
                code: "MONSOON30",
                description: "30% off on monsoon season treks",
                discount_type: "conditional",
                discount_value: 30.00,
                min_amount: 1500.00,
                max_discount_amount: 1000.00,
                max_uses: 60,
                current_uses: 0,
                valid_from: new Date(),
                valid_until: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000), // 75 days from now
                status: "active",
            },

            // Group discount coupons
            {
                title: "Family Pack",
                vendor_id: vendors[4].id, // Sikkim Treks
                color: "#EC4899",
                code: "FAMILY40",
                description: "40% off for family bookings (4+ members)",
                discount_type: "group",
                discount_value: 40.00,
                min_amount: 4000.00,
                max_discount_amount: 2000.00,
                max_uses: 25,
                current_uses: 0,
                valid_from: new Date(),
                valid_until: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000), // 150 days from now
                status: "active",
            },
            {
                title: "Corporate Retreat",
                vendor_id: vendors[4].id,
                color: "#6366F1",
                code: "CORP35",
                description: "35% off for corporate group bookings",
                discount_type: "group",
                discount_value: 35.00,
                min_amount: 5000.00,
                max_discount_amount: 3000.00,
                max_uses: 20,
                current_uses: 0,
                valid_from: new Date(),
                valid_until: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000), // 200 days from now
                status: "active",
            },

            // Some expired coupons for testing
            {
                title: "New Year Special",
                vendor_id: vendors[0].id,
                color: "#DC2626",
                code: "NEWYEAR2024",
                description: "Special New Year discount (expired)",
                discount_type: "flat",
                discount_value: 100.00,
                min_amount: 500.00,
                max_uses: 50,
                current_uses: 50,
                valid_from: new Date("2024-01-01"),
                valid_until: new Date("2024-01-31"),
                status: "expired",
            },
            {
                title: "Winter Wonderland",
                vendor_id: vendors[1].id,
                color: "#0EA5E9",
                code: "WINTER12",
                description: "12% off winter treks (inactive)",
                discount_type: "percent",
                discount_value: 12.00,
                min_amount: 1000.00,
                max_discount_amount: 800.00,
                max_uses: 100,
                current_uses: 25,
                valid_from: new Date(),
                valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                status: "inactive",
            },
        ];

        await Coupon.bulkCreate(coupons);
        console.log("Coupons seeded successfully!");

        // Display created coupons count by vendor
        for (const vendor of vendors) {
            const vendorCoupons = await Coupon.count({
                where: { vendor_id: vendor.id }
            });
            console.log(`${vendor.company_info?.company_name || 'Vendor'}: ${vendorCoupons} coupons`);
        }

        const totalCoupons = await Coupon.count();
        console.log(`Total coupons created: ${totalCoupons}`);

        // Display some sample coupon codes
        const sampleCoupons = await Coupon.findAll({
            limit: 5,
            attributes: ['code', 'title', 'discount_type', 'discount_value'],
            include: [{
                model: Vendor,
                as: 'vendor',
                attributes: ['company_info']
            }]
        });

        console.log("\nSample coupons:");
        sampleCoupons.forEach(coupon => {
            const companyName = coupon.vendor?.company_info?.company_name || 'Unknown Vendor';
            console.log(`- ${coupon.code}: ${coupon.title} (${coupon.discount_type} ₹${coupon.discount_value}) - ${companyName}`);
        });

    } catch (error) {
        console.error("Error seeding coupons:", error);
    }
};

module.exports = seedCoupons;

// Run if called directly
if (require.main === module) {
    const sequelize = require("../config/config");

    seedCoupons()
        .then(() => {
            process.exit(0);
        })
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
