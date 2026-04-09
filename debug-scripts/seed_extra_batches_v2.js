const { Batch, TrekStage } = require('./models');

async function seed() {
    try {
        const trekId = 110;
        const batch = await Batch.create({
            trek_id: trekId,
            start_date: '2026-03-31',
            end_date: '2026-04-05',
            capacity: 20,
            available_slots: 20,
            booked_slots: 0
        });
        
        console.log(`Seeded batch ID: ${batch.id} for trek ${trekId}`);
        
        // Add a boarding stage for this batch
        await TrekStage.create({
            trek_id: trekId,
            batch_id: batch.id,
            stage_name: 'boarding',
            is_boarding_point: true,
            city_id: 1, // Rishikesh
            date_time: '2026-03-31 07:00 AM'
        });
        
        console.log("Seeded boarding stage for the new batch");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

seed();
