"use strict";

const { City, State } = require("../models");

const seedCities = async () => {
    try {
        // Check if cities already exist
        const existingCities = await City.findAll();
        if (existingCities.length > 0) {
            console.log("Cities already exist, skipping seed.");
            return;
        }

        // Get all states to reference them properly
        const states = await State.findAll();
        const stateMap = {};
        states.forEach((state) => {
            stateMap[state.name] = state.id;
        });

        const cities = [
            // Uttarakhand - Major Trekking Hub
            {
                cityName: "Dehradun",
                isPopular: true,
                pickupPoint: "Dehradun Railway Station",
                stateId: stateMap["Uttarakhand"],
            },
            {
                cityName: "Rishikesh",
                isPopular: true,
                pickupPoint: "Rishikesh Bus Stand",
                stateId: stateMap["Uttarakhand"],
            },
            {
                cityName: "Haridwar",
                isPopular: true,
                pickupPoint: "Haridwar Railway Station",
                stateId: stateMap["Uttarakhand"],
            },
            {
                cityName: "Mussoorie",
                isPopular: true,
                pickupPoint: "Mussoorie Mall Road",
                stateId: stateMap["Uttarakhand"],
            },
            {
                cityName: "Nainital",
                isPopular: true,
                pickupPoint: "Nainital Bus Stand",
                stateId: stateMap["Uttarakhand"],
            },
            {
                cityName: "Almora",
                isPopular: false,
                pickupPoint: "Almora Bus Stand",
                stateId: stateMap["Uttarakhand"],
            },
            {
                cityName: "Ranikhet",
                isPopular: false,
                pickupPoint: "Ranikhet Mall Road",
                stateId: stateMap["Uttarakhand"],
            },

            // Himachal Pradesh
            {
                cityName: "Manali",
                isPopular: true,
                pickupPoint: "Manali Bus Stand",
                stateId: stateMap["Himachal Pradesh"],
            },
            {
                cityName: "Shimla",
                isPopular: true,
                pickupPoint: "Shimla Railway Station",
                stateId: stateMap["Himachal Pradesh"],
            },
            {
                cityName: "Dharamshala",
                isPopular: true,
                pickupPoint: "Dharamshala Bus Stand",
                stateId: stateMap["Himachal Pradesh"],
            },
            {
                cityName: "Kullu",
                isPopular: false,
                pickupPoint: "Kullu Bus Stand",
                stateId: stateMap["Himachal Pradesh"],
            },
            {
                cityName: "McLeod Ganj",
                isPopular: false,
                pickupPoint: "McLeod Ganj Main Square",
                stateId: stateMap["Himachal Pradesh"],
            },

            // Jammu and Kashmir
            {
                cityName: "Srinagar",
                isPopular: true,
                pickupPoint: "Srinagar Airport",
                stateId: stateMap["Jammu and Kashmir"],
            },
            {
                cityName: "Leh",
                isPopular: true,
                pickupPoint: "Leh Airport",
                stateId: stateMap["Ladakh"],
            },
            {
                cityName: "Kargil",
                isPopular: false,
                pickupPoint: "Kargil Bus Stand",
                stateId: stateMap["Ladakh"],
            },

            // Sikkim
            {
                cityName: "Gangtok",
                isPopular: true,
                pickupPoint: "Gangtok Bus Stand",
                stateId: stateMap["Sikkim"],
            },
            {
                cityName: "Lachung",
                isPopular: false,
                pickupPoint: "Lachung Village Center",
                stateId: stateMap["Sikkim"],
            },

            // Maharashtra
            {
                cityName: "Mumbai",
                isPopular: true,
                pickupPoint: "Mumbai Central Railway Station",
                stateId: stateMap["Maharashtra"],
            },
            {
                cityName: "Pune",
                isPopular: true,
                pickupPoint: "Pune Railway Station",
                stateId: stateMap["Maharashtra"],
            },
            {
                cityName: "Lonavala",
                isPopular: false,
                pickupPoint: "Lonavala Railway Station",
                stateId: stateMap["Maharashtra"],
            },
            {
                cityName: "Mahabaleshwar",
                isPopular: false,
                pickupPoint: "Mahabaleshwar Bus Stand",
                stateId: stateMap["Maharashtra"],
            },

            // Karnataka
            {
                cityName: "Bangalore",
                isPopular: true,
                pickupPoint: "Bangalore City Railway Station",
                stateId: stateMap["Karnataka"],
            },
            {
                cityName: "Mysore",
                isPopular: false,
                pickupPoint: "Mysore Railway Station",
                stateId: stateMap["Karnataka"],
            },

            // Kerala
            {
                cityName: "Kochi",
                isPopular: true,
                pickupPoint: "Kochi Airport",
                stateId: stateMap["Kerala"],
            },
            {
                cityName: "Munnar",
                isPopular: false,
                pickupPoint: "Munnar Bus Stand",
                stateId: stateMap["Kerala"],
            },

            // Tamil Nadu
            {
                cityName: "Chennai",
                isPopular: true,
                pickupPoint: "Chennai Central Railway Station",
                stateId: stateMap["Tamil Nadu"],
            },
            {
                cityName: "Ooty",
                isPopular: false,
                pickupPoint: "Ooty Bus Stand",
                stateId: stateMap["Tamil Nadu"],
            },

            // Rajasthan
            {
                cityName: "Jaipur",
                isPopular: true,
                pickupPoint: "Jaipur Railway Station",
                stateId: stateMap["Rajasthan"],
            },
            {
                cityName: "Udaipur",
                isPopular: false,
                pickupPoint: "Udaipur Railway Station",
                stateId: stateMap["Rajasthan"],
            },

            // Delhi
            {
                cityName: "New Delhi",
                isPopular: true,
                pickupPoint: "New Delhi Railway Station",
                stateId: stateMap["Delhi"],
            },

            // Goa
            {
                cityName: "Panaji",
                isPopular: true,
                pickupPoint: "Panaji Bus Stand",
                stateId: stateMap["Goa"],
            },
        ];

        await City.bulkCreate(cities);
        console.log("Cities seeded successfully!");

        // Display created cities count
        const createdCities = await City.findAll();
        console.log(`Created ${createdCities.length} cities`);
    } catch (error) {
        console.error("Error seeding cities:", error);
    }
};

module.exports = seedCities;

// Run if called directly
if (require.main === module) {
    const sequelize = require("../config/config");

    seedCities()
        .then(() => {
            process.exit(0);
        })
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
