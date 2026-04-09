const { sequelize } = require('./models');

async function seed() {
    try {
        const trekId = 107;
        const tbrId = 'TBR' + Date.now().toString().slice(-7);
        const query = `
            INSERT INTO batches (tbr_id, trek_id, start_date, end_date, capacity, available_slots, booked_slots, created_at, updated_at)
            VALUES ('${tbrId}', ${trekId}, '2026-03-31', '2026-04-05', 20, 20, 0, NOW(), NOW())
        `;
        await sequelize.query(query);
        console.log(`Successfully seeded batch with TBR ID: ${tbrId} for Trek: ${trekId}`);
        process.exit(0);
    } catch (e) {
        console.error("SEED FAILED:");
        console.error(e.message);
        process.exit(1);
    }
}

seed();
