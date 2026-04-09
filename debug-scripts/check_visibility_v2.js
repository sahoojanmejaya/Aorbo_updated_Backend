const { Trek, Batch, Destination, City } = require('./models');
const { Op } = require('sequelize');
const { sequelize } = require('./models');

async function check() {
    try {
        const city_id = "1";
        const destination_id = "2";
        const start_date = "2026-03-31";

        const whereClause = { status: "active", trek_status: "approved" };
        if (destination_id) whereClause.destination_id = destination_id;

        const numericCityId = parseInt(city_id);
        whereClause[Op.and] = [
            sequelize.literal(`(JSON_CONTAINS(city_ids, ${numericCityId}, '$') OR JSON_CONTAINS(city_ids, '"${numericCityId}"', '$'))`)
        ];

        const includes = [
            {
                model: Batch,
                as: "batches",
                where: {
                    start_date: { [Op.gte]: new Date(start_date) },
                },
                required: true,
            }
        ];

        console.log("WHERE:", JSON.stringify(whereClause, null, 2));
        console.log("START DATE RAW:", start_date);
        console.log("NEW DATE(start_date):", new Date(start_date).toISOString());

        const treks = await Trek.findAll({
            where: whereClause,
            include: includes,
            logging: console.log
        });

        console.log(`\nRESULT COUNT: ${treks.length}`);
        treks.forEach(t => {
            console.log(`- Trek ID: ${t.id}, Name: ${t.title}`);
        });

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
