const {
    Trek,
    Vendor,
    Destination,
    TrekCaptain,
    CancellationPolicy,
    Badge,
    Accommodation,
    Batch,
    ItineraryItem,
    TrekImage,
    TrekStage,
    City,
    Activity,
} = require("../models");

const seedDemoTrek = async () => {
    try {
        console.log("🌟 Seeding demo trek with all related data...");

        // First, let's get some existing data to reference
        const vendor = await Vendor.findOne({
            include: [
                {
                    model: require("../models").User,
                    as: "user",
                    attributes: ["id", "name"],
                },
            ],
        });

        const destination = await Destination.findOne({
            where: { status: "active" },
        });

        const captain = await TrekCaptain.findOne({
            where: { status: "active" },
        });

        const cancellationPolicy = await CancellationPolicy.findOne({
            where: { is_active: true },
        });

        const badge = await Badge.findOne({
            where: { is_active: true },
        });

        const cities = await City.findAll({
            limit: 3,
        });

        const activities = await Activity.findAll({
            where: { is_active: true },
            limit: 5,
        });

        if (
            !vendor ||
            !destination ||
            !captain ||
            !cancellationPolicy ||
            !badge ||
            cities.length === 0
        ) {
            console.error(
                "❌ Required data not found. Please ensure vendors, destinations, captains, cancellation policies, badges, cities, and activities exist."
            );
            return;
        }

        console.log("📋 Found required data:");
        console.log(`  - Vendor: ${vendor.user.name} (ID: ${vendor.id})`);
        console.log(
            `  - Destination: ${destination.name} (ID: ${destination.id})`
        );
        console.log(`  - Captain: ${captain.name} (ID: ${captain.id})`);
        console.log(
            `  - Cancellation Policy: ${cancellationPolicy.title} (ID: ${cancellationPolicy.id})`
        );
        console.log(`  - Badge: ${badge.name} (ID: ${badge.id})`);
        console.log(`  - Cities: ${cities.map((c) => c.cityName).join(", ")}`);
        console.log(
            `  - Activities: ${activities.map((a) => a.name).join(", ")}`
        );

        // Create the demo trek
        const demoTrek = await Trek.create({
            title: "Himalayan Adventure Trek",
            description:
                "Experience the breathtaking beauty of the Himalayas with this comprehensive trek that takes you through pristine forests, alpine meadows, and snow-capped peaks. Perfect for adventure enthusiasts and nature lovers.",
            vendor_id: vendor.id,
            destination_id: destination.id,
            captain_id: captain.id,
            city_ids: cities.map((city) => city.id),
            duration: "5 days, 4 nights",
            duration_days: 5,
            duration_nights: 4,
            base_price: 8500.0,
            max_participants: 15,
            trekking_rules:
                "1. Follow the guide's instructions at all times\n2. Stay with the group and don't wander off\n3. Carry sufficient water and snacks\n4. Respect local culture and environment\n5. No littering - carry your waste back\n6. Inform guide immediately if feeling unwell\n7. Wear appropriate trekking gear and footwear\n8. Be prepared for weather changes",
            emergency_protocols:
                "1. First aid kit available with guide\n2. Emergency contact numbers provided\n3. Nearest medical facilities identified\n4. Weather updates monitored regularly\n5. Emergency evacuation plan in place\n6. Guide trained in basic first aid\n7. Satellite phone for remote areas\n8. Regular health check-ins during trek",
            organizer_notes:
                "This trek is designed for moderate fitness levels. Participants should be able to walk 6-8 hours daily with breaks. Altitude acclimatization is built into the itinerary. All meals and accommodation included. Transportation from base camp to trek start point provided.",
            inclusions: [
                "All meals (breakfast, lunch, dinner)",
                "Accommodation in tents/guesthouses",
                "Professional trek guide",
                "Porter support for group gear",
                "First aid kit",
                "Permits and entry fees",
                "Transportation from base camp",
                "Safety equipment",
            ],
            exclusions: [
                "Personal trekking gear",
                "Personal expenses",
                "Tips for guides and porters",
                "Travel insurance",
                "Any additional meals",
                "Alcoholic beverages",
                "Personal medication",
                "Camera charges",
            ],
            status: "active",
            discount_value: 500.0,
            discount_type: "fixed",
            has_discount: true,
            cancellation_policy_id: cancellationPolicy.id,
            activities: activities.map((activity) => activity.id),
            badge_id: badge.id,
        });

        console.log(
            `✅ Created demo trek: ${demoTrek.title} (ID: ${demoTrek.id})`
        );

        // Create accommodations
        const accommodations = await Accommodation.bulkCreate([
            {
                trek_id: demoTrek.id,
                type: "tent",
                details: {
                    night: 2,
                    location: "Alpine Camp Site",
                },
            },
            {
                trek_id: demoTrek.id,
                type: "guesthouse",
                details: {
                    night: 2,
                    location: "Mountain Village Lodge",
                },
            },
        ]);

        console.log(`✅ Created ${accommodations.length} accommodations`);

        // Create batches for each city
        const batches = [];
        for (const city of cities) {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() + 30); // Start 30 days from now

            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 5); // 5 days duration

            const batch = await Batch.create({
                trek_id: demoTrek.id,
                start_date: startDate,
                end_date: endDate,
                capacity: 15,
                booked_slots: 0,
                available_slots: 15,
                city_id: city.id,
            });

            batches.push(batch);
        }

        console.log(`✅ Created ${batches.length} batches`);

        // Create itinerary items
        const itineraryItems = await ItineraryItem.bulkCreate([
            {
                trek_id: demoTrek.id,
                activities: [
                    "Arrival and briefing",
                    "Equipment check",
                    "Acclimatization walk",
                    "Team building activities",
                    "Evening campfire",
                ],
            },
            {
                trek_id: demoTrek.id,
                activities: [
                    "Early morning trek start",
                    "Forest trail exploration",
                    "Wildlife spotting",
                    "Photography session",
                    "Camp setup and dinner",
                ],
            },
            {
                trek_id: demoTrek.id,
                activities: [
                    "Alpine meadow crossing",
                    "Mountain stream crossing",
                    "Local village visit",
                    "Cultural interaction",
                    "Stargazing night",
                ],
            },
            {
                trek_id: demoTrek.id,
                activities: [
                    "Summit attempt",
                    "Panoramic views",
                    "Group photos",
                    "Descent to base camp",
                    "Celebration dinner",
                ],
            },
            {
                trek_id: demoTrek.id,
                activities: [
                    "Final day trek",
                    "Farewell ceremony",
                    "Certificate distribution",
                    "Return journey",
                    "Trip conclusion",
                ],
            },
        ]);

        console.log(`✅ Created ${itineraryItems.length} itinerary items`);

        // Create trek stages
        const trekStages = await TrekStage.bulkCreate([
            {
                trek_id: demoTrek.id,
                stage_name: "boarding",
                destination: "Base Camp Meeting Point",
                means_of_transport: "bus",
                date_time: "06:00 AM",
                is_boarding_point: true,
                city_id: cities[0].id,
            },
            {
                trek_id: demoTrek.id,
                stage_name: "meeting",
                destination: "Trek Starting Point",
                means_of_transport: "jeep",
                date_time: "08:00 AM",
                is_boarding_point: false,
                city_id: null,
            },
            {
                trek_id: demoTrek.id,
                stage_name: "return",
                destination: "Base Camp",
                means_of_transport: "bus",
                date_time: "06:00 PM",
                is_boarding_point: false,
                city_id: null,
            },
        ]);

        console.log(`✅ Created ${trekStages.length} trek stages`);

        // Create trek images (placeholder URLs)
        const trekImages = await TrekImage.bulkCreate([
            {
                trek_id: demoTrek.id,
                url: "trek-images/demo/trek_1_mountain_peak.jpg",
                is_cover: true,
            },
            {
                trek_id: demoTrek.id,
                url: "trek-images/demo/trek_1_alpine_meadow.jpg",
                is_cover: false,
            },
            {
                trek_id: demoTrek.id,
                url: "trek-images/demo/trek_1_camp_site.jpg",
                is_cover: false,
            },
            {
                trek_id: demoTrek.id,
                url: "trek-images/demo/trek_1_sunset_view.jpg",
                is_cover: false,
            },
            {
                trek_id: demoTrek.id,
                url: "trek-images/demo/trek_1_group_photo.jpg",
                is_cover: false,
            },
        ]);

        console.log(`✅ Created ${trekImages.length} trek images`);

        // Log the complete demo trek data
        console.log("\n📊 Demo Trek Summary:");
        console.log(`  - Trek ID: ${demoTrek.id}`);
        console.log(`  - MTR ID: ${demoTrek.mtr_id}`);
        console.log(`  - Title: ${demoTrek.title}`);
        console.log(`  - Price: ₹${demoTrek.base_price}`);
        console.log(`  - Duration: ${demoTrek.duration}`);
        console.log(`  - Max Participants: ${demoTrek.max_participants}`);
        console.log(`  - Cities: ${cities.map((c) => c.cityName).join(", ")}`);
        console.log(`  - Activities: ${activities.length} activities`);
        console.log(`  - Accommodations: ${accommodations.length} types`);
        console.log(`  - Batches: ${batches.length} batches`);
        console.log(`  - Itinerary Days: ${itineraryItems.length} days`);
        console.log(`  - Trek Stages: ${trekStages.length} stages`);
        console.log(`  - Images: ${trekImages.length} images (1 cover)`);

        console.log("\n✅ Demo trek seeding completed successfully!");
        return {
            trek: demoTrek,
            accommodations,
            batches,
            itineraryItems,
            trekStages,
            trekImages,
        };
    } catch (error) {
        console.error("❌ Error seeding demo trek:", error);
        throw error;
    }
};

module.exports = { seedDemoTrek };

// Run the seeder if this file is executed directly
if (require.main === module) {
    const runSeeder = async () => {
        try {
            console.log("🚀 Starting Demo Trek Seeder...");
            const result = await seedDemoTrek();

            if (result) {
                console.log("\n🎉 Demo trek created successfully!");
                console.log(`📋 Trek Details:`);
                console.log(`   - ID: ${result.trek.id}`);
                console.log(`   - MTR ID: ${result.trek.mtr_id}`);
                console.log(`   - Title: ${result.trek.title}`);
                console.log(`   - Price: ₹${result.trek.base_price}`);
                console.log(`   - Duration: ${result.trek.duration}`);
                console.log(`   - Status: ${result.trek.status}`);
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
