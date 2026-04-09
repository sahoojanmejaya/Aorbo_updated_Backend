const { Trek, Batch } = require("./models");

async function checkTreks() {
    try {
        const treks = await Trek.findAll({
            include: [{
                model: Batch,
                as: 'batches'
            }],
            limit: 5
        });

        console.log(`Found ${treks.length} treks.`);
        treks.forEach(t => {
            console.log(`Trek: ${t.title} (ID: ${t.id})`);
            console.log(`  Batches: ${t.batches.length}`);
            t.batches.forEach(b => {
                console.log(`    - Batch ID: ${b.id}, Start Date: ${b.start_date}, Price: ${b.price}`);
            });
        });

        process.exit(0);
    } catch (error) {
        console.error("Error checking treks:", error);
        process.exit(1);
    }
}

checkTreks();
