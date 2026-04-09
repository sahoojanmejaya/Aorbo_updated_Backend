const { Trek, Batch, Destination, City } = require('./models');
const fs = require('fs');

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

        const results = [];
        for (const trek of treks) {
            let cityNames = [];
            if (trek.city_ids && trek.city_ids.length > 0) {
                const cities = await City.findAll({
                    where: { id: trek.city_ids },
                    attributes: ['cityName']
                });
                cityNames = cities.map(c => c.cityName);
            }

            results.push({
                title: trek.title,
                source: cityNames.join(', '),
                destination: trek.destinationData ? trek.destinationData.name : 'N/A',
                dates: trek.batches.map(b => b.start_date)
            });
        }

        fs.writeFileSync('sample_treks.json', JSON.stringify(results, null, 2));
        console.log("Written to sample_treks.json");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

listSamples();
