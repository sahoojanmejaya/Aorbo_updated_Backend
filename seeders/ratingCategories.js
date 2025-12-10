const { RatingCategory } = require("../models");

const seedRatingCategories = async () => {
    try {
        console.log("🌟 Seeding rating categories...");

        const categories = [
            {
                name: "Safety and Security",
                description:
                    "Measures the safety measures, security protocols, and overall safety standards maintained during the trek",
                is_active: true,
                sort_order: 1,
            },
            {
                name: "Organizer Manner",
                description:
                    "Evaluates the behavior, professionalism, and communication skills of the trek organizers and guides",
                is_active: true,
                sort_order: 2,
            },
            {
                name: "Trek Planning",
                description:
                    "Assesses the quality of trek planning, itinerary execution, and overall organization of the trek",
                is_active: true,
                sort_order: 3,
            },
            {
                name: "Women Safety",
                description:
                    "Specifically evaluates the safety measures and comfort provided for women participants during the trek",
                is_active: true,
                sort_order: 4,
            },
        ];

        // Check if categories already exist to avoid duplicates
        const existingCategories = await RatingCategory.findAll({
            where: {
                name: categories.map((cat) => cat.name),
            },
        });

        const existingNames = existingCategories.map((cat) => cat.name);
        const newCategories = categories.filter(
            (cat) => !existingNames.includes(cat.name)
        );

        if (newCategories.length > 0) {
            await RatingCategory.bulkCreate(newCategories);
            console.log(
                `✅ Created ${newCategories.length} new rating categories`
            );
        } else {
            console.log("ℹ️  All rating categories already exist");
        }

        // Log all categories
        const allCategories = await RatingCategory.findAll({
            where: { is_active: true },
            order: [["sort_order", "ASC"]],
        });

        console.log("📊 Rating Categories:");
        allCategories.forEach((category) => {
            console.log(`  - ${category.name} (ID: ${category.id})`);
        });

        console.log("✅ Rating categories seeding completed!");
        return allCategories;
    } catch (error) {
        console.error("❌ Error seeding rating categories:", error);
        throw error;
    }
};

module.exports = { seedRatingCategories };

// Run the seeder if this file is executed directly
if (require.main === module) {
    const runSeeder = async () => {
        try {
            console.log("🚀 Starting Rating Categories Seeder...");
            await seedRatingCategories();
            console.log("✅ Seeder completed successfully!");
            process.exit(0);
        } catch (error) {
            console.error("❌ Seeder failed:", error);
            process.exit(1);
        }
    };

    runSeeder();
}
