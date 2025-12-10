const { Badge } = require("../models");

const badges = [
    {
        name: "Beginner Friendly",
        description: "Perfect for first-time trekkers",
        icon: "🌱",
        color: "#10B981",
        category: "difficulty",
        criteria: {
            max_difficulty: "easy",
            max_duration_days: 3,
        },
        is_active: true,
        sort_order: 1,
    },
    {
        name: "Advanced Trekker",
        description: "For experienced trekkers seeking challenges",
        icon: "🏔️",
        color: "#EF4444",
        category: "difficulty",
        criteria: {
            min_difficulty: "difficult",
            min_duration_days: 5,
        },
        is_active: true,
        sort_order: 2,
    },
    {
        name: "Photography Paradise",
        description: "Stunning landscapes perfect for photography",
        icon: "📸",
        color: "#8B5CF6",
        category: "special",
        criteria: {
            activities: [
                "photography",
                "mountain photography",
                "nature photography",
            ],
        },
        is_active: true,
        sort_order: 3,
    },
    {
        name: "Cultural Experience",
        description: "Rich cultural and spiritual experiences",
        icon: "🏛️",
        color: "#F59E0B",
        category: "special",
        criteria: {
            activities: [
                "temple visits",
                "local culture",
                "spiritual ceremonies",
            ],
        },
        is_active: true,
        sort_order: 4,
    },
    {
        name: "Monsoon Special",
        description: "Best experienced during monsoon season",
        icon: "🌧️",
        color: "#3B82F6",
        category: "seasonal",
        criteria: {
            best_season: "monsoon",
        },
        is_active: true,
        sort_order: 5,
    },
    {
        name: "Winter Wonderland",
        description: "Magical winter trekking experience",
        icon: "❄️",
        color: "#06B6D4",
        category: "seasonal",
        criteria: {
            best_season: "winter",
        },
        is_active: true,
        sort_order: 6,
    },
    {
        name: "Wildlife Spotting",
        description: "Excellent opportunities for wildlife observation",
        icon: "🦅",
        color: "#059669",
        category: "special",
        criteria: {
            activities: ["bird watching", "wildlife safari"],
        },
        is_active: true,
        sort_order: 7,
    },
    {
        name: "Adventure Certified",
        description: "Certified adventure trek with safety standards",
        icon: "🏆",
        color: "#DC2626",
        category: "certification",
        criteria: {
            safety_standards: "certified",
        },
        is_active: true,
        sort_order: 8,
    },
    {
        name: "Family Friendly",
        description: "Suitable for families with children",
        icon: "👨‍👩‍👧‍👦",
        color: "#EC4899",
        category: "special",
        criteria: {
            min_age: 8,
            max_difficulty: "moderate",
        },
        is_active: true,
        sort_order: 9,
    },
    {
        name: "Sunrise Special",
        description: "Spectacular sunrise views from mountain peaks",
        icon: "🌅",
        color: "#F97316",
        category: "special",
        criteria: {
            activities: ["sunrise viewing", "mountain views"],
        },
        is_active: true,
        sort_order: 10,
    },
];

const seedBadges = async () => {
    try {
        console.log("🌱 Seeding badges...");

        for (const badgeData of badges) {
            const [badge, created] = await Badge.findOrCreate({
                where: { name: badgeData.name },
                defaults: badgeData,
            });

            if (created) {
                console.log(`  ✅ Created badge: ${badgeData.name}`);
            } else {
                console.log(`  ⏭️  Badge already exists: ${badgeData.name}`);
            }
        }

        console.log("🎉 Badge seeding completed!");
    } catch (error) {
        console.error("❌ Error seeding badges:", error);
        throw error;
    }
};

const clearBadges = async () => {
    try {
        console.log("🧹 Clearing badges...");
        await Badge.destroy({ where: {} });
        console.log("✅ Badges cleared!");
    } catch (error) {
        console.error("❌ Error clearing badges:", error);
        throw error;
    }
};

module.exports = {
    seedBadges,
    clearBadges,
};

// Run if called directly
if (require.main === module) {
    const { sequelize } = require("../models");

    seedBadges()
        .then(() => {
            console.log("\n✨ Badge seeding completed!");
            process.exit(0);
        })
        .catch((err) => {
            console.error("❌ Badge seeding failed:", err);
            process.exit(1);
        });
}
