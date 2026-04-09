const { Trek } = require('./models');

async function fix() {
    try {
        // Update all approved treks to include Rishikesh (ID 1) if they are for Chopta
        const result = await Trek.update(
            { city_ids: [1] },
            { 
                where: { 
                    destination_id: 2,
                    city_ids: []
                } 
            }
        );
        console.log(`Updated ${result[0]} treks with city_id: 1`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

fix();
