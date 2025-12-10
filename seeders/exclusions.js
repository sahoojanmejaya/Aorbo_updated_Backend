const { Exclusion } = require("../models");

const seedExclusions = async () => {
    try {
        console.log("🌱 Seeding exclusions...");

        // Check if exclusions already exist
        const existingExclusions = await Exclusion.findAll();
        if (existingExclusions.length > 0) {
            console.log("Exclusions already exist, skipping seed.");
            return;
        }

        const popularExclusions = [
            {
                name: "Personal Expenses",
                description: "Personal expenses like shopping, tips, etc.",
                usage_count: 95,
                is_active: true,
            },
            {
                name: "Airfare",
                description: "Flight tickets to and from the trek location",
                usage_count: 90,
                is_active: true,
            },
            {
                name: "Personal Equipment",
                description: "Personal trekking gear and equipment",
                usage_count: 85,
                is_active: true,
            },
            {
                name: "Alcoholic Beverages",
                description: "Any alcoholic drinks during the trek",
                usage_count: 80,
                is_active: true,
            },
            {
                name: "Extra Meals",
                description: "Meals outside the scheduled trek meals",
                usage_count: 75,
                is_active: true,
            },
            {
                name: "Emergency Evacuation",
                description: "Emergency helicopter evacuation costs",
                usage_count: 70,
                is_active: true,
            },
            {
                name: "Personal Insurance",
                description: "Personal travel insurance coverage",
                usage_count: 65,
                is_active: true,
            },
            {
                name: "Visa Fees",
                description: "International visa fees if applicable",
                usage_count: 60,
                is_active: true,
            },
            {
                name: "Extra Accommodation",
                description: "Additional accommodation before or after trek",
                usage_count: 55,
                is_active: true,
            },
            {
                name: "Transportation to Base",
                description: "Transportation to trek starting point",
                usage_count: 50,
                is_active: true,
            },
        ];

        await Exclusion.bulkCreate(popularExclusions, {
            ignoreDuplicates: true,
        });

        console.log(`✅ Created ${popularExclusions.length} exclusions`);
    } catch (error) {
        console.error("❌ Error seeding exclusions:", error);
        throw error;
    }
};

module.exports = seedExclusions;

// Run if called directly
if (require.main === module) {
    const { sequelize } = require("../models");

    seedExclusions()
        .then(() => {
            console.log("\n✨ Exclusions seeding completed!");
            process.exit(0);
        })
        .catch((err) => {
            console.error("❌ Exclusions seeding failed:", err);
            process.exit(1);
        });
}
