const { Trek, Batch, TrekStage } = require('./models');

async function fix() {
    try {
        const trekId = 110; // Tungnath
        
        // 1. Ensure city_ids includes 1
        await Trek.update(
            { city_ids: [1], status: 'active', trek_status: 'approved' },
            { where: { id: trekId } }
        );
        console.log(`Updated Trek ${trekId} (Tungnath) with city_ids: [1] and active status.`);

        // 2. Add batch for Mar 31
        const tbrId = 'TBR' + Date.now().toString().slice(-7);
        const batch = await Batch.create({
            tbr_id: tbrId,
            trek_id: trekId,
            start_date: '2026-03-31',
            end_date: '2026-04-05',
            capacity: 20,
            available_slots: 20,
            booked_slots: 0
        });
        console.log(`Created batch ${batch.id} for trek ${trekId} starting Mar 31.`);

        // 3. Add boarding stage
        await TrekStage.create({
            trek_id: trekId,
            batch_id: batch.id,
            stage_name: 'boarding',
            is_boarding_point: true,
            city_id: 1,
            date_time: '2026-03-31 07:00 AM'
        });
        console.log("Added boarding stage for the new batch.");

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

fix();
