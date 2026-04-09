const { Trek, Batch, Destination, City } = require('./models');

async function listSamples() {
    try {
        const treks = await Trek.findAll({
            where: { status: 'active', trek_status: 'approved' },
            limit: 5,
            include: [
                { model: Destination, as: 'destinationData', attributes: ['name'] },
                { model: Batch, as: 'batches', attributes: ['start_date'], limit: 3 }
            ]
        });

        console.log("\n--- AVAILABLE TREKS SAMPLE ---");
        for (const trek of treks) {
            const dest = trek.destinationData ? trek.destinationData.name : 'N/A';
            const dates = trek.batches.map(b => b.start_date).join(', ');
            
            // Get city names from city_ids
            let cityNames = [];
            if (trek.city_ids && trek.city_ids.length > 0) {
                const cities = await City.findAll({
                    where: { id: trek.city_ids },
                    attributes: ['cityName']
                });
                cityNames = cities.map(c => c.cityName);
            }

            console.log(`Trek: ${trek.title}`);
            console.log(`Source City: ${cityNames.join(', ') || 'N/A'}`);
            console.log(`Destination: ${dest}`);
            console.log(`Upcoming Dates: ${dates || 'No upcoming batches'}`);
            console.log('------------------------------');
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

listSamples();
