"use strict";

const { BoardingPoint, City } = require("../models");

const seedBoardingPoints = async () => {
    try {
        // Check if boarding points already exist
        const existingBoardingPoints = await BoardingPoint.findAll();
        if (existingBoardingPoints.length > 0) {
            console.log("Boarding points already exist, skipping seed.");
            return;
        }

        // Get all cities to reference them properly
        const cities = await City.findAll();
        const cityMap = {};
        cities.forEach((city) => {
            cityMap[city.cityName] = city.id;
        });

        const boardingPoints = [
            // Dehradun
            {
                name: "Dehradun Railway Station",
                cityId: cityMap["Dehradun"],
            },
            {
                name: "Dehradun Bus Stand",
                cityId: cityMap["Dehradun"],
            },
            {
                name: "Dehradun Airport",
                cityId: cityMap["Dehradun"],
            },
            {
                name: "Paltan Bazaar",
                cityId: cityMap["Dehradun"],
            },

            // Rishikesh
            {
                name: "Rishikesh Railway Station",
                cityId: cityMap["Rishikesh"],
            },
            {
                name: "Rishikesh Bus Stand",
                cityId: cityMap["Rishikesh"],
            },
            {
                name: "Laxman Jhula",
                cityId: cityMap["Rishikesh"],
            },
            {
                name: "Ram Jhula",
                cityId: cityMap["Rishikesh"],
            },

            // Haridwar
            {
                name: "Haridwar Railway Station",
                cityId: cityMap["Haridwar"],
            },
            {
                name: "Haridwar Bus Stand",
                cityId: cityMap["Haridwar"],
            },
            {
                name: "Har Ki Pauri",
                cityId: cityMap["Haridwar"],
            },

            // Manali
            {
                name: "Manali Bus Stand",
                cityId: cityMap["Manali"],
            },
            {
                name: "Manali Mall Road",
                cityId: cityMap["Manali"],
            },
            {
                name: "Old Manali",
                cityId: cityMap["Manali"],
            },

            // Shimla
            {
                name: "Shimla Railway Station",
                cityId: cityMap["Shimla"],
            },
            {
                name: "Shimla Bus Stand",
                cityId: cityMap["Shimla"],
            },
            {
                name: "The Ridge",
                cityId: cityMap["Shimla"],
            },
        ];

        await BoardingPoint.bulkCreate(boardingPoints);
        console.log("✅ Boarding points seeded successfully");
    } catch (error) {
        console.error("❌ Error seeding boarding points:", error);
    }
};

const clearBoardingPoints = async () => {
    try {
        await BoardingPoint.destroy({ where: {} });
        console.log("✅ Boarding points cleared successfully");
    } catch (error) {
        console.error("❌ Error clearing boarding points:", error);
    }
};

module.exports = {
    seedBoardingPoints,
    clearBoardingPoints,
};
