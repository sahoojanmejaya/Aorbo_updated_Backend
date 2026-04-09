const { Trek, Batch, Destination, Vendor, TrekStage, TrekImage, Booking, Rating } = require("./models");
const moment = require("moment");

async function seedTreks() {
    try {
        const trekIds = [106, 107, 108];
        
        // Clean up
        await Booking.destroy({ where: { trek_id: trekIds } });
        await Rating.destroy({ where: { trek_id: trekIds } });
        await TrekStage.destroy({ where: { trek_id: trekIds } });
        await TrekImage.destroy({ where: { trek_id: trekIds } });
        await Batch.destroy({ where: { trek_id: trekIds } });
        await Trek.destroy({ where: { id: trekIds } });
        
        console.log("Cleaned up previous seeding attempts.");

        const vendor = await Vendor.findOne();
        if (!vendor) {
            console.error("No vendor found.");
            process.exit(1);
        }

        const placeholderImage = "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1000";

        const trekData = [
            {
                id: 106,
                title: "Himalayan High Altitude Trek",
                description: "Experience the majestic beauty of the Himalayas.",
                base_price: 15000,
                duration: "7D 6N",
                duration_days: 7,
                duration_nights: 6,
                max_participants: 15,
                status: "active",
                trek_status: "approved",
                vendor_id: vendor.id,
                destination_id: 2, // Kedarnath Temple
                city_ids: JSON.stringify([1, 2]), // Dehradun, Rishikesh
                inclusions: JSON.stringify(["Guided Trek", "Meals"]),
                exclusions: JSON.stringify(["Personal Expenses"]),
                activities: JSON.stringify([1, 2, 3]),
                dates: ["2026-03-20", "2026-03-31"]
            },
            {
                id: 107,
                title: "Western Ghats Monsoon Trail",
                description: "Explore the lush green trails of the Western Ghats.",
                base_price: 8500,
                duration: "3D 2N",
                duration_days: 3,
                duration_nights: 2,
                max_participants: 20,
                status: "active",
                trek_status: "approved",
                vendor_id: vendor.id,
                destination_id: 3, // Badrinath Temple
                city_ids: JSON.stringify([3, 4]), // Haridwar, Mussoorie
                inclusions: JSON.stringify(["Guide Fees", "Tents"]),
                exclusions: JSON.stringify(["Lunch"]),
                activities: JSON.stringify([4, 5]),
                dates: ["2026-03-20", "2026-03-31"]
            },
            {
                id: 108,
                title: "Valley of Flowers Expedition",
                description: "A UNESCO World Heritage site known for its meadows.",
                base_price: 12500,
                duration: "6D 5N",
                duration_days: 6,
                duration_nights: 5,
                max_participants: 12,
                status: "active",
                trek_status: "approved",
                vendor_id: vendor.id,
                destination_id: 17, // Triund Trek
                city_ids: JSON.stringify([5, 6]), // Nainital, Almora
                inclusions: JSON.stringify(["Certified Guide", "Stay"]),
                exclusions: JSON.stringify(["Porter Charges"]),
                activities: JSON.stringify([1, 6]),
                dates: ["2026-03-20", "2026-03-31"]
            }
        ];

        for (const data of trekData) {
            const { dates, ...trekFields } = data;
            const trek = await Trek.create(trekFields);
            console.log(`Created Trek: ${trek.title} (ID: ${trek.id})`);

            await TrekImage.create({
                trek_id: trek.id,
                url: placeholderImage,
                is_cover: true
            });

            for (const dateStr of dates) {
                const startDate = moment(dateStr);
                const endDate = moment(startDate).add(trek.duration_days - 1, 'days');
                const batch = await Batch.create({
                    trek_id: trek.id,
                    start_date: startDate.format('YYYY-MM-DD'),
                    end_date: endDate.format('YYYY-MM-DD'),
                    capacity: trek.max_participants
                });

                const cities = JSON.parse(data.city_ids);
                for (const cityId of cities) {
                    await TrekStage.create({
                        trek_id: trek.id,
                        batch_id: batch.id,
                        stage_name: "boarding",
                        destination: "Base Camp",
                        means_of_transport: "Bus",
                        date_time: `${batch.start_date} 06:00 AM`, // Essential for filtering
                        is_boarding_point: true,
                        city_id: cityId
                    });
                }
            }
        }

        console.log("Seeding completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("Error seeding treks:", error);
        process.exit(1);
    }
}

seedTreks();
