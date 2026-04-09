const { City, Destination } = require("./models");

async function getLabels() {
    try {
        const cities = await City.findAll({ 
            attributes: ['id', 'cityName'],
            where: { id: [1, 2, 3, 4, 5, 6, 83, 84, 85, 86] } 
        });
        const destinations = await Destination.findAll({ 
            attributes: ['id', 'name'],
            limit: 20 
        });

        console.log('--- CITIES (Sources) ---');
        cities.forEach(c => console.log(`ID: ${c.id}, Name: ${c.cityName}`));

        console.log('--- DESTINATIONS ---');
        destinations.forEach(d => console.log(`ID: ${d.id}, Name: ${d.name}`));

        process.exit(0);
    } catch (error) {
        console.error("Error fetching labels:", error);
        process.exit(1);
    }
}

getLabels();
