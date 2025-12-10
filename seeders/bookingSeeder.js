const {
    Booking,
    BookingTraveler,
    Customer,
    Trek,
    Vendor,
    Batch,
    Traveler,
} = require("../models");

const seedBookings = async () => {
    try {
        console.log("🌟 Seeding demo bookings with booking travelers...");

        // Get existing data for the booking
        const customer = await Customer.findOne({
            where: { name: "Priya Sharma" },
        });

        const trek = await Trek.findOne({
            where: { title: "Himalayan Adventure Trek" },
        });

        const vendor = await Vendor.findOne({
            include: [
                {
                    model: require("../models").User,
                    as: "user",
                    attributes: ["id", "name"],
                },
            ],
        });

        const batch = await Batch.findOne({
            where: { trek_id: trek?.id },
        });

        const travelers = await Traveler.findAll({
            where: { customer_id: customer?.id },
        });

        if (!customer || !trek || !vendor || !batch || travelers.length === 0) {
            console.error(
                "❌ Required data not found. Please ensure customer, trek, vendor, batch, and travelers exist."
            );
            return;
        }

        console.log("📋 Found required data:");
        console.log(`  - Customer: ${customer.name} (ID: ${customer.id})`);
        console.log(`  - Trek: ${trek.title} (ID: ${trek.id})`);
        console.log(`  - Vendor: ${vendor.user.name} (ID: ${vendor.id})`);
        console.log(`  - Batch: ${batch.tbr_id} (ID: ${batch.id})`);
        console.log(`  - Travelers: ${travelers.length} travelers found`);

        // Calculate booking amounts
        const basePrice = parseFloat(trek.base_price);
        const discountAmount = parseFloat(trek.discount_value || 0);
        const finalAmount = basePrice - discountAmount;
        const totalAmount = basePrice * travelers.length;
        const totalDiscount = discountAmount * travelers.length;
        const totalFinalAmount = finalAmount * travelers.length;

        // Create the demo booking
        const demoBooking = await Booking.create({
            customer_id: customer.id,
            trek_id: trek.id,
            vendor_id: vendor.id,
            batch_id: batch.id,
            coupon_id: null, // No coupon for demo
            total_travelers: travelers.length,
            total_amount: totalAmount,
            discount_amount: totalDiscount,
            final_amount: totalFinalAmount,
            payment_status: "completed",
            status: "confirmed",
            booking_date: new Date(),
            special_requests:
                "Please provide vegetarian meals for both travelers. We would prefer shared accommodation if possible. Also, please ensure the trek guide speaks Hindi as one of our travelers is more comfortable with Hindi.",
            booking_source: "mobile",
            primary_contact_traveler_id: travelers[0].id, // Priya Sharma as primary contact
        });

        console.log(`✅ Created demo booking: ID ${demoBooking.id}`);

        // Create booking travelers
        const bookingTravelers = await BookingTraveler.bulkCreate([
            {
                booking_id: demoBooking.id,
                traveler_id: travelers[0].id, // Priya Sharma
                is_primary: true,
                special_requirements:
                    "Vegetarian meals only. Prefers shared accommodation. Comfortable with Hindi-speaking guide.",
                accommodation_preference: "shared",
                meal_preference: "veg",
                status: "confirmed",
            },
            {
                booking_id: demoBooking.id,
                traveler_id: travelers[1].id, // Aarav Sharma
                is_primary: false,
                special_requirements:
                    "Vegetarian meals. Can share accommodation. Enjoys photography during treks.",
                accommodation_preference: "shared",
                meal_preference: "veg",
                status: "confirmed",
            },
        ]);

        console.log(`✅ Created ${bookingTravelers.length} booking travelers`);

        // Log the complete booking data
        console.log("\n📊 Demo Booking Summary:");
        console.log(`  - Booking ID: ${demoBooking.id}`);
        console.log(`  - Customer: ${customer.name}`);
        console.log(`  - Trek: ${trek.title}`);
        console.log(`  - Batch: ${batch.tbr_id}`);
        console.log(`  - Total Travelers: ${demoBooking.total_travelers}`);
        console.log(`  - Total Amount: ₹${demoBooking.total_amount}`);
        console.log(`  - Discount Amount: ₹${demoBooking.discount_amount}`);
        console.log(`  - Final Amount: ₹${demoBooking.final_amount}`);
        console.log(`  - Payment Status: ${demoBooking.payment_status}`);
        console.log(`  - Booking Status: ${demoBooking.status}`);
        console.log(`  - Booking Source: ${demoBooking.booking_source}`);
        console.log(`  - Primary Contact: ${travelers[0].name}`);

        // Log booking travelers details
        console.log("\n👥 Booking Travelers:");
        bookingTravelers.forEach((bt, index) => {
            const traveler = travelers.find((t) => t.id === bt.traveler_id);
            console.log(`\n  Traveler ${index + 1}:`);
            console.log(`    - Name: ${traveler.name}`);
            console.log(`    - Age: ${traveler.age}`);
            console.log(`    - Gender: ${traveler.gender}`);
            console.log(
                `    - Primary Contact: ${bt.is_primary ? "Yes" : "No"}`
            );
            console.log(`    - Accommodation: ${bt.accommodation_preference}`);
            console.log(`    - Meal Preference: ${bt.meal_preference}`);
            console.log(`    - Status: ${bt.status}`);
            console.log(
                `    - Special Requirements: ${bt.special_requirements}`
            );
        });

        // Fetch booking with all associations to verify
        const bookingWithAssociations = await Booking.findOne({
            where: { id: demoBooking.id },
            include: [
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name", "email", "phone"],
                },
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "base_price"],
                },
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
                {
                    model: Batch,
                    as: "batch",
                    attributes: ["id", "tbr_id", "start_date", "end_date"],
                },
                {
                    model: BookingTraveler,
                    as: "travelers",
                    include: [
                        {
                            model: Traveler,
                            as: "traveler",
                            attributes: ["id", "name", "age", "gender"],
                        },
                    ],
                },
            ],
        });

        console.log("\n🔗 Booking Associations:");
        console.log(`  - Customer: ${bookingWithAssociations.customer.name}`);
        console.log(`  - Trek: ${bookingWithAssociations.trek.title}`);
        console.log(`  - Vendor: ${bookingWithAssociations.vendor.user.name}`);
        console.log(`  - Batch: ${bookingWithAssociations.batch.tbr_id}`);
        console.log(
            `  - Travelers: ${bookingWithAssociations.travelers.length} travelers`
        );

        console.log("\n✅ Demo booking seeding completed successfully!");
        return {
            booking: demoBooking,
            bookingTravelers: bookingTravelers,
            customer: customer,
            trek: trek,
            vendor: vendor,
            batch: batch,
            travelers: travelers,
        };
    } catch (error) {
        console.error("❌ Error seeding demo booking:", error);
        throw error;
    }
};

module.exports = { seedBookings };

// Run the seeder if this file is executed directly
if (require.main === module) {
    const runSeeder = async () => {
        try {
            console.log("🚀 Starting Demo Booking Seeder...");
            const result = await seedBookings();

            if (result) {
                console.log("\n🎉 Demo booking created successfully!");
                console.log(`📋 Booking Details:`);
                console.log(`   - ID: ${result.booking.id}`);
                console.log(`   - Customer: ${result.customer.name}`);
                console.log(`   - Trek: ${result.trek.title}`);
                console.log(
                    `   - Total Amount: ₹${result.booking.total_amount}`
                );
                console.log(
                    `   - Final Amount: ₹${result.booking.final_amount}`
                );
                console.log(`   - Status: ${result.booking.status}`);
                console.log(
                    `   - Travelers: ${result.bookingTravelers.length}`
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
