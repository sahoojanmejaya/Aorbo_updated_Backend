const { Trek, Batch, Destination, City } = require('./models');
const { Op } = require('sequelize');
const { sequelize } = require('./models');

async function check() {
    try {
        const city_id = "1";
        const destination_id = "2";
        const start_date = "2026-03-31";

        console.log("--- TEST 1: Basic Trek Check ---");
        const allTreks = await Trek.findAll({
            where: { destination_id },
            attributes: ['id', 'title', 'status', 'trek_status', 'city_ids']
        });
        console.log(`Found ${allTreks.length} treks for destination ${destination_id}`);
        allTreks.forEach(t => {
            console.log(`ID: ${t.id}, Name: ${t.title}, Status: ${t.status}, TrekStatus: ${t.trek_status}, CityIds: ${JSON.stringify(t.city_ids)}`);
        });

        console.log("\n--- TEST 2: City ID Filter Check ---");
        const numericCityId = parseInt(city_id);
        const cityTreks = await Trek.findAll({
            where: {
                destination_id,
                [Op.and]: [
                    sequelize.literal(`(JSON_CONTAINS(city_ids, ${numericCityId}, '$') OR JSON_CONTAINS(city_ids, '"${numericCityId}"', '$'))`)
                ]
            }
        });
        console.log(`City Filter Count: ${cityTreks.length}`);

        console.log("\n--- TEST 3: Date Filter Check ---");
        const dateTreks = await Trek.findAll({
            where: { destination_id },
            include: [{
                model: Batch,
                as: 'batches',
                where: {
                    start_date: { [Op.gte]: new Date(start_date) }
                }
            }]
        });
        console.log(`Date Filter Count: ${dateTreks.length}`);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
