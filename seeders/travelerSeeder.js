const { Traveler, Customer } = require("../models");

const seedTravelers = async () => {
    try {
        console.log("🌟 Seeding demo travelers...");

        // Get existing customer for the travelers
        const customer = await Customer.findOne({
            where: { name: "Priya Sharma" },
        });

        if (!customer) {
            console.error(
                "❌ Required customer (Priya Sharma) not found. Please run customerSeeder.js first."
            );
            return;
        }

        console.log("📋 Found required data:");
        console.log(`  - Customer: ${customer.name} (ID: ${customer.id})`);

        // Create the demo travelers
        const travelers = await Traveler.bulkCreate([
            {
                customer_id: customer.id,
                name: "Priya Sharma",
                age: 30,
                gender: "female",
                is_active: true,
            },
            {
                customer_id: customer.id,
                name: "Aarav Sharma",
                age: 28,
                gender: "male",
                is_active: true,
            },
        ]);

        console.log(`✅ Created ${travelers.length} demo travelers`);

        // Log the complete traveler data
        console.log("\n📊 Demo Travelers Summary:");
        travelers.forEach((traveler, index) => {
            console.log(`\n  Traveler ${index + 1}:`);
            console.log(`    - ID: ${traveler.id}`);
            console.log(`    - Name: ${traveler.name}`);
            console.log(`    - Age: ${traveler.age}`);
            console.log(`    - Gender: ${traveler.gender}`);
            console.log(`    - Active: ${traveler.is_active ? "Yes" : "No"}`);
            console.log(`    - Customer ID: ${traveler.customer_id}`);
        });

        // Fetch travelers with customer association to verify
        const travelersWithCustomer = await Traveler.findAll({
            where: { customer_id: customer.id },
            include: [
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name", "email", "phone"],
                },
            ],
        });

        console.log("\n🔗 Traveler Associations:");
        travelersWithCustomer.forEach((traveler) => {
            console.log(
                `  - ${traveler.name} (ID: ${traveler.id}) belongs to ${traveler.customer.name}`
            );
        });

        console.log("\n✅ Demo travelers seeding completed successfully!");
        return {
            travelers: travelers,
            customer: customer,
        };
    } catch (error) {
        console.error("❌ Error seeding demo travelers:", error);
        throw error;
    }
};

module.exports = { seedTravelers };

// Run the seeder if this file is executed directly
if (require.main === module) {
    const runSeeder = async () => {
        try {
            console.log("🚀 Starting Demo Travelers Seeder...");
            const result = await seedTravelers();

            if (result) {
                console.log("\n🎉 Demo travelers created successfully!");
                console.log(`📋 Traveler Details:`);
                result.travelers.forEach((traveler, index) => {
                    console.log(`   Traveler ${index + 1}:`);
                    console.log(`     - ID: ${traveler.id}`);
                    console.log(`     - Name: ${traveler.name}`);
                    console.log(`     - Age: ${traveler.age}`);
                    console.log(`     - Gender: ${traveler.gender}`);
                });
                console.log(
                    `   Customer: ${result.customer.name} (ID: ${result.customer.id})`
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
