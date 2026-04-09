const { Batch } = require('./models');

async function seed() {
    try {
        // Create batches for March 31
        await Batch.bulkCreate([
            {
                trek_id: 110,
                tbr_id: 'TBR-TEST-31',
                start_date: '2026-03-31',
                end_date: '2026-04-05',
                capacity: 20,
                available_slots: 20,
                booked_slots: 0,
                status: 'open'
            }
        ]);
        console.log("Seeded batch for 2026-03-31");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

seed();
