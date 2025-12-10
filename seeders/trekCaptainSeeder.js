const { TrekCaptain, Vendor } = require("../models");

const seedTrekCaptains = async () => {
    try {
        console.log("🌟 Seeding demo trek captains...");

        // Get existing vendor for the captains
        const vendor = await Vendor.findOne({
            include: [
                {
                    model: require("../models").User,
                    as: "user",
                    attributes: ["id", "name"],
                },
            ],
        });

        if (!vendor) {
            console.error(
                "❌ Required vendor not found. Please ensure vendors exist."
            );
            return;
        }

        console.log("📋 Found required data:");
        console.log(`  - Vendor: ${vendor.user.name} (ID: ${vendor.id})`);

        // Create the demo trek captains
        const captains = await TrekCaptain.bulkCreate([
            {
                vendor_id: vendor.id,
                name: "Rajesh Kumar",
                phone: "+91-9876543210",
                email: "rajesh.kumar@example.com",
                status: "active",
            },
            {
                vendor_id: vendor.id,
                name: "Anita Patel",
                phone: "+91-9876543212",
                email: "anita.patel@example.com",
                status: "active",
            },
            {
                vendor_id: vendor.id,
                name: "Suresh Singh",
                phone: "+91-9876543214",
                email: "suresh.singh@example.com",
                status: "active",
            },
        ]);

        console.log(`✅ Created ${captains.length} demo trek captains`);

        // Log the complete captain data
        console.log("\n📊 Demo Trek Captains Summary:");
        captains.forEach((captain, index) => {
            console.log(`\n  Captain ${index + 1}:`);
            console.log(`    - ID: ${captain.id}`);
            console.log(`    - Name: ${captain.name}`);
            console.log(`    - Phone: ${captain.phone}`);
            console.log(`    - Email: ${captain.email}`);
            console.log(`    - Status: ${captain.status}`);
        });

        // Fetch captains with vendor association to verify
        const captainsWithVendor = await TrekCaptain.findAll({
            where: { vendor_id: vendor.id },
            include: [
                {
                    model: Vendor,
                    as: "vendor",
                    attributes: ["id"],
                    include: [
                        {
                            model: require("../models").User,
                            as: "user",
                            attributes: ["name"],
                        },
                    ],
                },
            ],
        });

        console.log("\n🔗 Captain Associations:");
        captainsWithVendor.forEach((captain) => {
            console.log(
                `  - ${captain.name} (ID: ${captain.id}) belongs to ${captain.vendor.user.name}`
            );
        });

        console.log("\n✅ Demo trek captains seeding completed successfully!");
        return {
            captains: captains,
            vendor: vendor,
        };
    } catch (error) {
        console.error("❌ Error seeding demo trek captains:", error);
        throw error;
    }
};

module.exports = { seedTrekCaptains };

// Run the seeder if this file is executed directly
if (require.main === module) {
    const runSeeder = async () => {
        try {
            console.log("🚀 Starting Demo Trek Captains Seeder...");
            const result = await seedTrekCaptains();

            if (result) {
                console.log("\n🎉 Demo trek captains created successfully!");
                console.log(`📋 Captain Details:`);
                result.captains.forEach((captain, index) => {
                    console.log(`   Captain ${index + 1}:`);
                    console.log(`     - ID: ${captain.id}`);
                    console.log(`     - Name: ${captain.name}`);
                    console.log(`     - Status: ${captain.status}`);
                });
            }

            console.log("✅ Seeder completed successfully!");
            process.exit(0);
        } catch (error) {
            console.error("❌ Seeder failed:", error);
            process.exit(1);
        }
    };

    runSeeder();
}
