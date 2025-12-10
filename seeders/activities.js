const { Activity } = require("../models");

const activitiesData = [
    {
        name: "Trekking",
        category_name: "Adventure",
        is_active: true,
    },
    {
        name: "Rock Climbing",
        category_name: "Adventure",
        is_active: true,
    },
    {
        name: "Camping",
        category_name: "Outdoor",
        is_active: true,
    },
    {
        name: "Bird Watching",
        category_name: "Nature",
        is_active: true,
    },
    {
        name: "Photography",
        category_name: "Creative",
        is_active: true,
    },
    {
        name: "River Rafting",
        category_name: "Water Sports",
        is_active: true,
    },
    {
        name: "Mountain Biking",
        category_name: "Adventure",
        is_active: true,
    },
    {
        name: "Yoga",
        category_name: "Wellness",
        is_active: true,
    },
    {
        name: "Meditation",
        category_name: "Wellness",
        is_active: true,
    },
    {
        name: "Local Cuisine",
        category_name: "Cultural",
        is_active: true,
    },
    {
        name: "Village Visit",
        category_name: "Cultural",
        is_active: true,
    },
    {
        name: "Stargazing",
        category_name: "Nature",
        is_active: true,
    },
    {
        name: "Wildlife Safari",
        category_name: "Nature",
        is_active: true,
    },
    {
        name: "Fishing",
        category_name: "Outdoor",
        is_active: true,
    },
    {
        name: "Bonfire",
        category_name: "Social",
        is_active: true,
    },
];

async function seedActivities() {
    try {
        console.log("🌱 Seeding activities...");

        for (const activityData of activitiesData) {
            const [activity, created] = await Activity.findOrCreate({
                where: { name: activityData.name },
                defaults: activityData,
            });

            if (created) {
                console.log(`  ✅ Created activity: ${activityData.name}`);
            } else {
                console.log(
                    `  ⏭️  Activity already exists: ${activityData.name}`
                );
            }
        }

        console.log("🎉 Activities seeded successfully!");
    } catch (error) {
        console.error("❌ Error seeding activities:", error);
        throw error;
    }
}

module.exports = seedActivities;

// Run if called directly
if (require.main === module) {
    const { sequelize } = require("../models");

    seedActivities()
        .then(() => {
            console.log("\n✨ Activities seeding completed!");
            process.exit(0);
        })
        .catch((err) => {
            console.error("❌ Activities seeding failed:", err);
            process.exit(1);
        });
}
