const { Trek, Batch, Destination, City } = require('./models');
const { Op } = require('sequelize');

async function check() {
    try {
        const cityId = 1;
        const destId = 2;
        const startDate = "2026-03-31";

        console.log(`Checking for City: ${cityId}, Dest: ${destId}, Date: ${startDate}`);

        const treks = await Trek.findAll({
            where: {
                destination_id: destId,
                status: 'active',
                trek_status: 'approved'
            },
            include: [{
                model: Batch,
                as: 'batches'
            }]
        });

        console.log(`Found ${treks.length} treks for destination ${destId}`);
        treks.forEach(t => {
            console.log(`Trek ID: ${t.id}, Name: ${t.title}, City IDs: ${t.city_ids}`);
            const matchesCity = t.city_ids.includes(cityId) || t.city_ids.includes(cityId.toString());
            console.log(`- Matches City ${cityId}? ${matchesCity}`);
            
            t.batches.forEach(b => {
                console.log(`  - Batch ID: ${b.id}, Start Date: ${b.start_date}`);
                const dateMatch = new Date(b.start_date) >= new Date(startDate);
                console.log(`    - Matches Date >= ${startDate}? ${dateMatch}`);
            });
        });

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
