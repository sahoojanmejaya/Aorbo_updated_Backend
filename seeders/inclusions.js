const { Inclusion } = require("../models");

const seedInclusions = async () => {
    try {
        console.log("🌱 Seeding inclusions...");

        // Check if inclusions already exist
        const existingInclusions = await Inclusion.findAll();
        if (existingInclusions.length > 0) {
            console.log("Inclusions already exist, skipping seed.");
            return;
        }

        const popularInclusions = [
            {
                name: "Accommodation",
                description: "Hotel or camping accommodation during the trek",
                usage_count: 95,
                is_active: true,
            },
            {
                name: "Meals",
                description:
                    "All meals (breakfast, lunch, dinner) during the trek",
                usage_count: 90,
                is_active: true,
            },
            {
                name: "Transportation",
                description: "Pickup and drop from designated points",
                usage_count: 85,
                is_active: true,
            },
            {
                name: "Guide",
                description: "Professional trek guide throughout the journey",
                usage_count: 80,
                is_active: true,
            },
            {
                name: "Permits",
                description: "All necessary permits and entry fees",
                usage_count: 75,
                is_active: true,
            },
            {
                name: "Equipment",
                description: "Trekking equipment and safety gear",
                usage_count: 70,
                is_active: true,
            },
            {
                name: "First Aid",
                description: "Basic first aid kit and medical support",
                usage_count: 65,
                is_active: true,
            },
            {
                name: "Photography",
                description: "Professional photography services",
                usage_count: 60,
                is_active: true,
            },
            {
                name: "Insurance",
                description: "Travel and trek insurance coverage",
                usage_count: 55,
                is_active: true,
            },
            {
                name: "Certificate",
                description: "Trek completion certificate",
                usage_count: 50,
                is_active: true,
            },
        ];

        await Inclusion.bulkCreate(popularInclusions, {
            ignoreDuplicates: true,
        });

        console.log(`✅ Created ${popularInclusions.length} inclusions`);
    } catch (error) {
        console.error("❌ Error seeding inclusions:", error);
        throw error;
    }
};

module.exports = seedInclusions;

// Run if called directly
if (require.main === module) {
    const { sequelize } = require("../models");

    seedInclusions()
        .then(() => {
            console.log("\n✨ Inclusions seeding completed!");
            process.exit(0);
        })
        .catch((err) => {
            console.error("❌ Inclusions seeding failed:", err);
            process.exit(1);
        });
}
