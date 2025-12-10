const { Customer, City, State } = require("../models");

const seedCustomer = async () => {
    try {
        console.log("🌟 Seeding demo customer with complete profile...");

        // Get existing city and state for the customer
        const city = await City.findOne({
            where: { cityName: "Mumbai" },
        });

        const state = await State.findOne({
            where: { name: "Maharashtra" },
        });

        if (!city || !state) {
            console.error(
                "❌ Required city (Mumbai) or state (Maharashtra) not found. Please ensure cities and states exist."
            );
            return;
        }

        console.log("📋 Found required data:");
        console.log(`  - City: ${city.cityName} (ID: ${city.id})`);
        console.log(`  - State: ${state.name} (ID: ${state.id})`);

        // Create the demo customer
        const demoCustomer = await Customer.create({
            name: "Priya Sharma",
            email: "priya.sharma@example.com",
            phone: "+91-9876543210",
            firebase_uid: "demo_firebase_uid_12345",
            date_of_birth: "1995-03-15",
            emergency_contact: {
                name: "Rajesh Sharma",
                relationship: "Father",
                phone: "+91-9876543211",
                email: "rajesh.sharma@example.com",
                address:
                    "123, Sunshine Apartments, Andheri West, Mumbai - 400058",
            },
            verification_status: "verified",
            profile_completed: true,
            last_login: new Date(),
            status: "active",
            city_id: city.id,
            state_id: state.id,
        });

        console.log(
            `✅ Created demo customer: ${demoCustomer.name} (ID: ${demoCustomer.id})`
        );

        // Log the complete customer data
        console.log("\n📊 Demo Customer Summary:");
        console.log(`  - Customer ID: ${demoCustomer.id}`);
        console.log(`  - Name: ${demoCustomer.name}`);
        console.log(`  - Email: ${demoCustomer.email}`);
        console.log(`  - Phone: ${demoCustomer.phone}`);
        console.log(`  - Date of Birth: ${demoCustomer.date_of_birth}`);
        console.log(
            `  - Verification Status: ${demoCustomer.verification_status}`
        );
        console.log(
            `  - Profile Completed: ${
                demoCustomer.profile_completed ? "Yes" : "No"
            }`
        );
        console.log(`  - Status: ${demoCustomer.status}`);
        console.log(`  - City: ${city.cityName}`);
        console.log(`  - State: ${state.name}`);
        console.log(
            `  - Emergency Contact: ${demoCustomer.emergency_contact.name} (${demoCustomer.emergency_contact.relationship})`
        );

        // Fetch the customer with associations to verify
        const customerWithAssociations = await Customer.findOne({
            where: { id: demoCustomer.id },
            include: [
                {
                    model: City,
                    as: "city",
                    attributes: ["id", "cityName"],
                },
                {
                    model: State,
                    as: "state",
                    attributes: ["id", "name"],
                },
            ],
        });

        console.log("\n🔗 Customer Associations:");
        console.log(
            `  - City: ${
                customerWithAssociations.city?.cityName || "Not found"
            }`
        );
        console.log(
            `  - State: ${customerWithAssociations.state?.name || "Not found"}`
        );

        console.log("\n✅ Demo customer seeding completed successfully!");
        return {
            customer: demoCustomer,
            city: city,
            state: state,
        };
    } catch (error) {
        console.error("❌ Error seeding demo customer:", error);
        throw error;
    }
};

module.exports = { seedCustomer };

// Run the seeder if this file is executed directly
if (require.main === module) {
    const runSeeder = async () => {
        try {
            console.log("🚀 Starting Demo Customer Seeder...");
            const result = await seedCustomer();

            if (result) {
                console.log("\n🎉 Demo customer created successfully!");
                console.log(`📋 Customer Details:`);
                console.log(`   - ID: ${result.customer.id}`);
                console.log(`   - Name: ${result.customer.name}`);
                console.log(`   - Email: ${result.customer.email}`);
                console.log(`   - Phone: ${result.customer.phone}`);
                console.log(`   - Status: ${result.customer.status}`);
                console.log(
                    `   - Verification: ${result.customer.verification_status}`
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
