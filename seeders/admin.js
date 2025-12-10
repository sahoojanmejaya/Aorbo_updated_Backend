const { User, Role } = require("../models");
const bcrypt = require("bcrypt");

const seedAdmin = async () => {
    try {
        // Check if admin already exists
        const adminRole = await Role.findOne({ where: { name: "admin" } });
        if (!adminRole) {
            console.log("Admin role not found. Please run roles seeder first.");
            return;
        }

        const existingAdmin = await User.findOne({
            where: { email: "admin@aorbo.com" },
        });

        if (existingAdmin) {
            console.log("Admin user already exists, skipping seed.");
            return;
        }

        // Create admin user
        const passwordHash = await bcrypt.hash("admin123", 10);

        const admin = await User.create({
            name: "Admin User",
            email: "admin@aorbo.com",
            phone: "+91 9999999999",
            passwordHash,
            roleId: adminRole.id,
        });

        console.log("Admin user created successfully!");
        console.log("Email: admin@aorbo.com");
        console.log("Password: admin123");
    } catch (error) {
        console.error("Error seeding admin:", error);
    }
};

module.exports = seedAdmin;

// Run if called directly
if (require.main === module) {
    const sequelize = require("../config/config");

    seedAdmin()
        .then(() => {
            process.exit(0);
        })
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
