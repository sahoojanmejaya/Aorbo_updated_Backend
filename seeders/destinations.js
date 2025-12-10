"use strict";

const { Destination } = require("../models");

const seedDestinations = async () => {
    try {
        // Check if destinations already exist
        const existingDestinations = await Destination.findAll();
        if (existingDestinations.length > 0) {
            console.log("Destinations already exist, skipping seed.");
            return;
        }

        const destinations = [
            // Uttarakhand Destinations
            {
                name: "Valley of Flowers",
                state: "Uttarakhand",
                is_popular: true,
                status: "active",
                boarding_location: "Govindghat",
            },
            {
                name: "Kedarnath Temple",
                state: "Uttarakhand",
                is_popular: true,
                status: "active",
                boarding_location: "Gaurikund",
            },
            {
                name: "Badrinath Temple",
                state: "Uttarakhand",
                is_popular: true,
                status: "active",
                boarding_location: "Badrinath Bus Stand",
            },
            {
                name: "Gangotri Glacier",
                state: "Uttarakhand",
                is_popular: false,
                status: "active",
                boarding_location: "Gangotri",
            },
            {
                name: "Yamunotri",
                state: "Uttarakhand",
                is_popular: false,
                status: "active",
                boarding_location: "Janki Chatti",
            },
            {
                name: "Rishikesh Adventure Hub",
                state: "Uttarakhand",
                is_popular: true,
                status: "active",
                boarding_location: "Rishikesh Railway Station",
            },
            {
                name: "Lakshman Jhula",
                state: "Uttarakhand",
                is_popular: false,
                status: "active",
                boarding_location: "Rishikesh",
            },
            {
                name: "Har Ki Pauri",
                state: "Uttarakhand",
                is_popular: true,
                status: "active",
                boarding_location: "Haridwar Railway Station",
            },
            {
                name: "Mussoorie Hills",
                state: "Uttarakhand",
                is_popular: true,
                status: "active",
                boarding_location: "Dehradun Airport",
            },
            {
                name: "Naini Lake",
                state: "Uttarakhand",
                is_popular: true,
                status: "active",
                boarding_location: "Nainital Bus Stand",
            },

            // Himachal Pradesh Destinations
            {
                name: "Solang Valley",
                state: "Himachal Pradesh",
                is_popular: true,
                status: "active",
                boarding_location: "Manali Bus Stand",
            },
            {
                name: "Rohtang Pass",
                state: "Himachal Pradesh",
                is_popular: true,
                status: "active",
                boarding_location: "Manali",
            },
            {
                name: "Hadimba Temple",
                state: "Himachal Pradesh",
                is_popular: false,
                status: "active",
                boarding_location: "Manali",
            },
            {
                name: "Mall Road",
                state: "Himachal Pradesh",
                is_popular: true,
                status: "active",
                boarding_location: "Shimla",
            },
            {
                name: "Kufri",
                state: "Himachal Pradesh",
                is_popular: true,
                status: "active",
                boarding_location: "Shimla",
            },
            {
                name: "Dalai Lama Temple",
                state: "Himachal Pradesh",
                is_popular: true,
                status: "active",
                boarding_location: "McLeod Ganj",
            },
            {
                name: "Triund Trek",
                state: "Himachal Pradesh",
                is_popular: false,
                status: "active",
                boarding_location: "McLeod Ganj",
            },

            // Jammu and Kashmir Destinations
            {
                name: "Dal Lake",
                state: "Jammu and Kashmir",
                is_popular: true,
                status: "active",
                boarding_location: "Srinagar Airport",
            },
            {
                name: "Gulmarg",
                state: "Jammu and Kashmir",
                is_popular: true,
                status: "active",
                boarding_location: "Srinagar",
            },
            {
                name: "Pahalgam",
                state: "Jammu and Kashmir",
                is_popular: false,
                status: "active",
                boarding_location: "Srinagar",
            },

            // Ladakh Destinations
            {
                name: "Pangong Lake",
                state: "Ladakh",
                is_popular: true,
                status: "active",
                boarding_location: "Leh Airport",
            },
            {
                name: "Nubra Valley",
                state: "Ladakh",
                is_popular: true,
                status: "active",
                boarding_location: "Leh",
            },
            {
                name: "Khardungla Pass",
                state: "Ladakh",
                is_popular: true,
                status: "active",
                boarding_location: "Leh",
            },

            // Sikkim Destinations
            {
                name: "Tsomgo Lake",
                state: "Sikkim",
                is_popular: true,
                status: "active",
                boarding_location: "Gangtok",
            },
            {
                name: "Nathula Pass",
                state: "Sikkim",
                is_popular: true,
                status: "active",
                boarding_location: "Gangtok",
            },
            {
                name: "Yumthang Valley",
                state: "Sikkim",
                is_popular: false,
                status: "active",
                boarding_location: "Lachung",
            },

            // Maharashtra Destinations
            {
                name: "Gateway of India",
                state: "Maharashtra",
                is_popular: true,
                status: "active",
                boarding_location: "Mumbai Airport",
            },
            {
                name: "Marine Drive",
                state: "Maharashtra",
                is_popular: true,
                status: "active",
                boarding_location: "Mumbai Central",
            },
            {
                name: "Lonavala Caves",
                state: "Maharashtra",
                is_popular: false,
                status: "active",
                boarding_location: "Lonavala Station",
            },
            {
                name: "Mahabaleshwar Hills",
                state: "Maharashtra",
                is_popular: false,
                status: "active",
                boarding_location: "Mahabaleshwar",
            },

            // Karnataka Destinations
            {
                name: "Lalbagh Botanical Garden",
                state: "Karnataka",
                is_popular: true,
                status: "active",
                boarding_location: "Bangalore Airport",
            },
            {
                name: "Mysore Palace",
                state: "Karnataka",
                is_popular: true,
                status: "active",
                boarding_location: "Mysore Railway Station",
            },

            // Kerala Destinations
            {
                name: "Chinese Fishing Nets",
                state: "Kerala",
                is_popular: true,
                status: "active",
                boarding_location: "Cochin",
            },
            {
                name: "Munnar Tea Gardens",
                state: "Kerala",
                is_popular: false,
                status: "active",
                boarding_location: "Munnar",
            },

            // Tamil Nadu Destinations
            {
                name: "Marina Beach",
                state: "Tamil Nadu",
                is_popular: true,
                status: "active",
                boarding_location: "Chennai Central",
            },
            {
                name: "Ooty Botanical Gardens",
                state: "Tamil Nadu",
                is_popular: false,
                status: "active",
                boarding_location: "Ooty",
            },

            // Rajasthan Destinations
            {
                name: "Amber Fort",
                state: "Rajasthan",
                is_popular: true,
                status: "active",
                boarding_location: "Jaipur",
            },
            {
                name: "Lake Palace",
                state: "Rajasthan",
                is_popular: true,
                status: "active",
                boarding_location: "Udaipur",
            },

            // Delhi Destinations
            {
                name: "Red Fort",
                state: "Delhi",
                is_popular: true,
                status: "active",
                boarding_location: "Delhi Junction",
            },
            {
                name: "Qutub Minar",
                state: "Delhi",
                is_popular: true,
                status: "active",
                boarding_location: "Delhi Airport",
            },

            // Goa Destinations
            {
                name: "Calangute Beach",
                state: "Goa",
                is_popular: true,
                status: "active",
                boarding_location: "Panaji",
            },
            {
                name: "Basilica of Bom Jesus",
                state: "Goa",
                is_popular: true,
                status: "active",
                boarding_location: "Old Goa",
            },
        ];

        await Destination.bulkCreate(destinations);
        console.log("Destinations seeded successfully!");

        // Display created destinations count
        const createdDestinations = await Destination.findAll();
        console.log(`Created ${createdDestinations.length} destinations`);
    } catch (error) {
        console.error("Error seeding destinations:", error);
    }
};

module.exports = seedDestinations;

// Run if called directly
if (require.main === module) {
    const sequelize = require("../config/config");

    seedDestinations()
        .then(() => {
            process.exit(0);
        })
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
