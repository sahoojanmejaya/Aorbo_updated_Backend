const {
    Rating,
    Review,
    Customer,
    Trek,
    Booking,
} = require("../models");

const seedRatingsAndReviews = async () => {
    try {
        console.log("🌟 Seeding demo ratings and reviews...");

        // Get existing data for the ratings and reviews
        const customer = await Customer.findOne({
            where: { name: "Priya Sharma" },
        });

        const trek = await Trek.findOne({
            where: { title: "Himalayan Adventure Trek" },
        });

        const booking = await Booking.findOne({
            where: { customer_id: customer?.id },
        });

        if (!customer || !trek || !booking) {
            console.error(
                "❌ Required data not found. Please ensure customer, trek, and booking exist."
            );
            return;
        }

        console.log("📋 Found required data:");
        console.log(`  - Customer: ${customer.name} (ID: ${customer.id})`);
        console.log(`  - Trek: ${trek.title} (ID: ${trek.id})`);
        console.log(`  - Booking: ID ${booking.id}`);

        // Create ratings with new structure (no category_id)
        const ratings = await Rating.bulkCreate([
            {
                trek_id: trek.id,
                customer_id: customer.id,
                booking_id: booking.id,
                rating_value: 4.5,
                title: "Amazing Trek Experience!",
                content: "Excellent safety measures throughout the trek. The guide was very attentive and always ensured our safety.",
                safety_security_count: 1,
                organizer_manner_count: 0,
                trek_planning_count: 0,
                women_safety_count: 0,
                is_verified: true,
                is_approved: true,
                is_helpful: 0,
                status: "approved"
            },
            {
                trek_id: trek.id,
                customer_id: customer.id,
                booking_id: booking.id,
                rating_value: 5.0,
                title: "Great Organizer!",
                content: "The organizer was very professional and friendly. Clear communication and excellent service.",
                safety_security_count: 0,
                organizer_manner_count: 1,
                trek_planning_count: 0,
                women_safety_count: 0,
                is_verified: true,
                is_approved: true,
                is_helpful: 0,
                status: "approved"
            },
            {
                trek_id: trek.id,
                customer_id: customer.id,
                booking_id: booking.id,
                rating_value: 4.8,
                title: "Well Planned Trek",
                content: "Well-planned itinerary with perfect timing. The trek was organized very efficiently.",
                safety_security_count: 0,
                organizer_manner_count: 0,
                trek_planning_count: 1,
                women_safety_count: 0,
                is_verified: true,
                is_approved: true,
                is_helpful: 0,
                status: "approved"
            },
            {
                trek_id: trek.id,
                customer_id: customer.id,
                booking_id: booking.id,
                rating_value: 4.7,
                title: "Safe for Women Travelers",
                content: "As a female traveler, I felt very safe and comfortable throughout the trek. Special attention to women's needs.",
                safety_security_count: 0,
                organizer_manner_count: 0,
                trek_planning_count: 0,
                women_safety_count: 1,
                is_verified: true,
                is_approved: true,
                is_helpful: 0,
                status: "approved"
            },
        ]);

        console.log(`✅ Created ${ratings.length} ratings`);

        // Create a comprehensive review
        const review = await Review.create({
            trek_id: trek.id,
            customer_id: customer.id,
            booking_id: booking.id,
            title: "Amazing Himalayan Adventure - Highly Recommended!",
            content: `My husband and I had an incredible experience on the Himalayan Adventure Trek! From the moment we booked until the end of our journey, everything was perfectly organized.

The trek exceeded our expectations in every way. The scenery was absolutely breathtaking - from lush forests to alpine meadows and snow-capped peaks. Our guide was knowledgeable, experienced, and always prioritized our safety.

Highlights of our trip:
• Stunning panoramic views from the summit
• Delicious vegetarian meals throughout
• Comfortable shared accommodation
• Professional and friendly staff
• Perfect weather conditions
• Memorable cultural interactions with local villagers

The trek was challenging but manageable, and the pace was perfect for our fitness level. The safety measures were excellent, and as a female traveler, I felt completely safe and comfortable throughout the journey.

Special thanks to our guide who spoke Hindi and made us feel at home. The photography opportunities were incredible, and we captured some amazing memories.

We would definitely recommend this trek to anyone looking for an authentic Himalayan experience. The value for money is excellent, and the memories will last a lifetime!

Rating: 5/5 stars - A must-do adventure!`,
            is_verified: true,
            is_approved: true,
            is_helpful: 12,
            status: "approved",
        });

        console.log(`✅ Created 1 comprehensive review`);

        // Log the complete ratings and reviews data
        console.log("\n📊 Demo Ratings Summary:");
        ratings.forEach((rating, index) => {
            console.log(`\n  Rating ${index + 1}:`);
            console.log(`    - Title: ${rating.title}`);
            console.log(`    - Rating: ${rating.rating_value}/5`);
            console.log(`    - Content: ${rating.content}`);
            console.log(`    - Safety Security: ${rating.safety_security_count}`);
            console.log(`    - Organizer Manner: ${rating.organizer_manner_count}`);
            console.log(`    - Trek Planning: ${rating.trek_planning_count}`);
            console.log(`    - Women Safety: ${rating.women_safety_count}`);
            console.log(`    - Verified: ${rating.is_verified ? "Yes" : "No"}`);
        });

        console.log("\n📝 Demo Review Summary:");
        console.log(`  - Title: ${review.title}`);
        console.log(`  - Status: ${review.status}`);
        console.log(`  - Verified: ${review.is_verified ? "Yes" : "No"}`);
        console.log(`  - Approved: ${review.is_approved ? "Yes" : "No"}`);
        console.log(`  - Helpful Count: ${review.is_helpful}`);
        console.log(`  - Content Length: ${review.content.length} characters`);

        // Calculate average rating
        const averageRating =
            ratings.reduce(
                (sum, rating) => sum + parseFloat(rating.rating_value),
                0
            ) / ratings.length;

        console.log("\n📈 Overall Rating Summary:");
        console.log(`  - Total Ratings: ${ratings.length}`);
        console.log(`  - Average Rating: ${averageRating.toFixed(2)}/5`);
        console.log(`  - Categories Rated: ${ratingCategories.length}`);
        console.log(
            `  - Verified Ratings: ${
                ratings.filter((r) => r.is_verified).length
            }`
        );

        // Fetch ratings with associations to verify
        const ratingsWithAssociations = await Rating.findAll({
            where: { trek_id: trek.id },
            include: [
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name"],
                },
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title"],
                },
                {
                    model: Booking,
                    as: "booking",
                    attributes: ["id"],
                },
            ],
        });

        console.log("\n🔗 Rating Associations:");
        ratingsWithAssociations.forEach((rating) => {
            console.log(
                `  - ${rating.customer.name} rated ${rating.trek.title} ${rating.rating_value}/5`
            );
        });

        // Fetch review with associations
        const reviewWithAssociations = await Review.findOne({
            where: { id: review.id },
            include: [
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name"],
                },
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title"],
                },
                {
                    model: Booking,
                    as: "booking",
                    attributes: ["id"],
                },
            ],
        });

        console.log("\n🔗 Review Associations:");
        console.log(
            `  - ${reviewWithAssociations.customer.name} reviewed ${reviewWithAssociations.trek.title}`
        );
        console.log(`  - Review Status: ${reviewWithAssociations.status}`);
        console.log(`  - Helpful Count: ${reviewWithAssociations.is_helpful}`);

        console.log(
            "\n✅ Demo ratings and reviews seeding completed successfully!"
        );
        return {
            ratings: ratings,
            review: review,
            customer: customer,
            trek: trek,
            booking: booking,
            ratingCategories: ratingCategories,
        };
    } catch (error) {
        console.error("❌ Error seeding demo ratings and reviews:", error);
        throw error;
    }
};

module.exports = { seedRatingsAndReviews };

// Run the seeder if this file is executed directly
if (require.main === module) {
    const runSeeder = async () => {
        try {
            console.log("🚀 Starting Demo Ratings and Reviews Seeder...");
            const result = await seedRatingsAndReviews();

            if (result) {
                console.log(
                    "\n🎉 Demo ratings and reviews created successfully!"
                );
                console.log(`📋 Summary:`);
                console.log(
                    `   - Ratings: ${result.ratings.length} ratings created`
                );
                console.log(`   - Review: 1 comprehensive review created`);
                console.log(`   - Customer: ${result.customer.name}`);
                console.log(`   - Trek: ${result.trek.title}`);
                console.log(
                    `   - Categories: ${result.ratingCategories.length} categories rated`
                );
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
