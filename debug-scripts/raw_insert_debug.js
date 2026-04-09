const { sequelize } = require('./models');

async function debug() {
    try {
        const query = `
            INSERT INTO batches (tbr_id, trek_id, start_date, end_date, capacity, available_slots, booked_slots, created_at, updated_at)
            VALUES ('TBR12345', 110, '2026-03-31', '2026-04-05', 20, 20, 0, NOW(), NOW())
        `;
        await sequelize.query(query);
        console.log("INSERT SUCCESSFUL");
        process.exit(0);
    } catch (e) {
        console.error("INSERT FAILED:");
        console.error(e.message);
        // Error might be in e.original
        if (e.original) {
            console.error("ORIGINAL ERROR:");
            console.error(e.original.sqlMessage || e.original);
        }
        process.exit(1);
    }
}

debug();
