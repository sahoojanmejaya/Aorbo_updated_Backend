"use strict";

const { State } = require("../models");

const seedStates = async () => {
    try {
        // Check if states already exist
        const existingStates = await State.findAll();
        if (existingStates.length > 0) {
            console.log("States already exist, skipping seed.");
            return;
        }

        const states = [
            // North India - Major Trekking States
            {
                name: "Uttarakhand",
                status: "active",
            },
            {
                name: "Himachal Pradesh",
                status: "active",
            },
            {
                name: "Jammu and Kashmir",
                status: "active",
            },
            {
                name: "Ladakh",
                status: "active",
            },
            {
                name: "Punjab",
                status: "active",
            },
            {
                name: "Haryana",
                status: "active",
            },
            {
                name: "Delhi",
                status: "active",
            },
            {
                name: "Chandigarh",
                status: "active",
            },
            {
                name: "Rajasthan",
                status: "active",
            },
            {
                name: "Uttar Pradesh",
                status: "active",
            },

            // North-East India
            {
                name: "Sikkim",
                status: "active",
            },
            {
                name: "Arunachal Pradesh",
                status: "active",
            },
            {
                name: "Assam",
                status: "active",
            },
            {
                name: "Manipur",
                status: "active",
            },
            {
                name: "Meghalaya",
                status: "active",
            },
            {
                name: "Mizoram",
                status: "active",
            },
            {
                name: "Nagaland",
                status: "active",
            },
            {
                name: "Tripura",
                status: "active",
            },

            // South India
            {
                name: "Karnataka",
                status: "active",
            },
            {
                name: "Kerala",
                status: "active",
            },
            {
                name: "Tamil Nadu",
                status: "active",
            },
            {
                name: "Andhra Pradesh",
                status: "active",
            },
            {
                name: "Telangana",
                status: "active",
            },

            // West India
            {
                name: "Maharashtra",
                status: "active",
            },
            {
                name: "Gujarat",
                status: "active",
            },
            {
                name: "Goa",
                status: "active",
            },

            // Central India
            {
                name: "Madhya Pradesh",
                status: "active",
            },
            {
                name: "Chhattisgarh",
                status: "active",
            },

            // East India
            {
                name: "Jharkhand",
                status: "active",
            },
            {
                name: "Bihar",
                status: "active",
            },
            {
                name: "West Bengal",
                status: "active",
            },
            {
                name: "Odisha",
                status: "active",
            },
        ];

        await State.bulkCreate(states);
        console.log("States seeded successfully!");

        // Display created states count
        const createdStates = await State.findAll();
        console.log(`Created ${createdStates.length} states`);
    } catch (error) {
        console.error("Error seeding states:", error);
    }
};

module.exports = seedStates;

// Run if called directly
if (require.main === module) {
    const sequelize = require("../config/config");

    seedStates()
        .then(() => {
            process.exit(0);
        })
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
