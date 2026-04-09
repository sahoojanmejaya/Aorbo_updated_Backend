const { Trek, Batch, TrekStage, Vendor } = require('./models');

async function seed() {
    try {
        // 1. Get a valid vendor
        const vendor = await Vendor.findOne();
        if (!vendor) throw new Error("No vendor found");

        // 2. Create a fresh trek
        const trek = await Trek.create({
            title: 'March 31 Test Trek',
            description: 'A test trek for March 31 visibility',
            vendor_id: vendor.id,
            destination_id: 2, // Chopta
            city_ids: [1], // Rishikesh
            status: 'active',
            trek_status: 'approved',
            base_price: 5000,
            duration_days: 3,
            duration_nights: 2
        });
        
        console.log(`Successfully created Trek: ${trek.title} with ID: ${trek.id}`);

        // 3. Create batch for Mar 31
        const tbrId = 'TBR' + Date.now().toString().slice(-7);
        const batch = await Batch.create({
            tbr_id: tbrId,
            trek_id: trek.id,
            start_date: '2026-03-31',
            end_date: '2026-04-03',
            capacity: 20,
            available_slots: 20,
            booked_slots: 0
        });
        
        console.log(`Created batch ${batch.id} with TBR ${tbrId}`);

        // 4. Create boarding stage
        await TrekStage.create({
            trek_id: trek.id,
            batch_id: batch.id,
            stage_name: 'boarding',
            is_boarding_point: true,
            city_id: 1,
            date_time: '2026-03-31 07:00 AM'
        });
        
        console.log("Added boarding stage.");
        process.exit(0);
    } catch (e) {
        console.error("SEED FAILED:");
        console.error(e.message);
        process.exit(1);
    }
}

seed();
