"use strict";

const { User, Vendor, Role } = require("../models");
const bcrypt = require("bcrypt");

const seedVendors = async () => {
    try {
        // Check if vendor role exists
        const vendorRole = await Role.findOne({ where: { name: "vendor" } });
        if (!vendorRole) {
            console.log(
                "Vendor role not found. Please run roles seeder first."
            );
            return;
        }

        // Check if vendors already exist
        const existingVendors = await Vendor.findAll();
        if (existingVendors.length > 0) {
            console.log("Vendors already exist, skipping seed.");
            return;
        }

        const vendors = [
            {
                user: {
                    name: "Himalayan Adventures",
                    email: "himalayan@aorbo.com",
                    phone: "+91 9876543210",
                    passwordHash: await bcrypt.hash("vendor123", 10),
                    roleId: vendorRole.id,
                },
                vendor: {
                    company_info: {
                        company_name: "Himalayan Adventures Pvt Ltd",
                        contact_person: "Rajesh Kumar",
                        phone: "+91 9876543210",
                        email: "himalayan@aorbo.com",
                        address: "123 Mall Road, Dehradun, Uttarakhand",
                        gst_number: "GST123456789",
                        pan_number: "ABCDE1234F",
                        bank_name: "State Bank of India",
                        account_number: "1234567890",
                        ifsc_code: "SBIN0001234",
                        commission_rate: 15.0,
                    },
                    status: "active",
                },
            },
            {
                user: {
                    name: "Mountain Trails",
                    email: "mountain@aorbo.com",
                    phone: "+91 9876543211",
                    passwordHash: await bcrypt.hash("vendor123", 10),
                    roleId: vendorRole.id,
                },
                vendor: {
                    company_info: {
                        company_name: "Mountain Trails & Tours",
                        contact_person: "Priya Sharma",
                        phone: "+91 9876543211",
                        email: "mountain@aorbo.com",
                        address: "456 Ridge Road, Manali, Himachal Pradesh",
                        gst_number: "GST987654321",
                        pan_number: "FGHIJ5678K",
                        bank_name: "HDFC Bank",
                        account_number: "0987654321",
                        ifsc_code: "HDFC0001234",
                        commission_rate: 12.0,
                    },
                    status: "active",
                },
            },
            {
                user: {
                    name: "Adventure Zone",
                    email: "adventure@aorbo.com",
                    phone: "+91 9876543212",
                    passwordHash: await bcrypt.hash("vendor123", 10),
                    roleId: vendorRole.id,
                },
                vendor: {
                    company_info: {
                        company_name: "Adventure Zone India",
                        contact_person: "Amit Patel",
                        phone: "+91 9876543212",
                        email: "adventure@aorbo.com",
                        address: "789 Adventure Street, Rishikesh, Uttarakhand",
                        gst_number: "GST456789123",
                        pan_number: "KLMNO9012P",
                        bank_name: "ICICI Bank",
                        account_number: "1122334455",
                        ifsc_code: "ICIC0001234",
                        commission_rate: 18.0,
                    },
                    status: "active",
                },
            },
            {
                user: {
                    name: "Ladakh Expeditions",
                    email: "ladakh@aorbo.com",
                    phone: "+91 9876543213",
                    passwordHash: await bcrypt.hash("vendor123", 10),
                    roleId: vendorRole.id,
                },
                vendor: {
                    company_info: {
                        company_name: "Ladakh Expeditions & Tours",
                        contact_person: "Sonam Dorje",
                        phone: "+91 9876543213",
                        email: "ladakh@aorbo.com",
                        address: "321 Leh Road, Leh, Ladakh",
                        gst_number: "GST789123456",
                        pan_number: "PQRST3456U",
                        bank_name: "Axis Bank",
                        account_number: "5566778899",
                        ifsc_code: "UTIB0001234",
                        commission_rate: 20.0,
                    },
                    status: "active",
                },
            },
            {
                user: {
                    name: "Sikkim Treks",
                    email: "sikkim@aorbo.com",
                    phone: "+91 9876543214",
                    passwordHash: await bcrypt.hash("vendor123", 10),
                    roleId: vendorRole.id,
                },
                vendor: {
                    company_info: {
                        company_name: "Sikkim Treks & Adventures",
                        contact_person: "Tenzin Wangchuk",
                        phone: "+91 9876543214",
                        email: "sikkim@aorbo.com",
                        address: "654 MG Marg, Gangtok, Sikkim",
                        gst_number: "GST321654987",
                        pan_number: "UVWXY7890Z",
                        bank_name: "Punjab National Bank",
                        account_number: "9988776655",
                        ifsc_code: "PUNB0001234",
                        commission_rate: 16.0,
                    },
                    status: "active",
                },
            },
        ];

        for (const vendorData of vendors) {
            // Create user first
            const user = await User.create(vendorData.user);

            // Create vendor with user association
            await Vendor.create({
                ...vendorData.vendor,
                user_id: user.id,
            });
        }

        console.log("Vendors seeded successfully!");
        console.log("Vendor login credentials:");
        console.log("Email: himalayan@aorbo.com, Password: vendor123");
        console.log("Email: mountain@aorbo.com, Password: vendor123");
        console.log("Email: adventure@aorbo.com, Password: vendor123");
        console.log("Email: ladakh@aorbo.com, Password: vendor123");
        console.log("Email: sikkim@aorbo.com, Password: vendor123");

        // Display created vendors count
        const createdVendors = await Vendor.findAll();
        console.log(`Created ${createdVendors.length} vendors`);
    } catch (error) {
        console.error("Error seeding vendors:", error);
    }
};

module.exports = seedVendors;

// Run if called directly
if (require.main === module) {
    const sequelize = require("../config/config");

    seedVendors()
        .then(() => {
            process.exit(0);
        })
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
