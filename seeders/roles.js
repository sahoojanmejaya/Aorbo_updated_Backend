const { Role } = require("../models");

const seedRoles = async () => {
    try {
        // Check if roles already exist
        const existingRoles = await Role.findAll();
        if (existingRoles.length > 0) {
            console.log("Roles already exist, skipping seed.");
            return;
        }

        // Create basic roles
        const roles = [
            {
                name: "admin",
                description: "Administrator with full system access",
            },
            {
                name: "vendor",
                description: "Vendor who can create and manage treks",
            },
            {
                name: "user",
                description: "Regular user who can book treks",
            },
        ];

        await Role.bulkCreate(roles);
        console.log("Roles seeded successfully!");

        // Display created roles
        const createdRoles = await Role.findAll();
        console.log(
            "Created roles:",
            createdRoles.map((r) => ({ id: r.id, name: r.name }))
        );
    } catch (error) {
        console.error("Error seeding roles:", error);
    }
};

module.exports = seedRoles;

// Run if called directly
if (require.main === module) {
    const sequelize = require("../config/config");

    seedRoles()
        .then(() => {
            process.exit(0);
        })
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
