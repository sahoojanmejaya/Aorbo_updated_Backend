const { sequelize } = require('./models');

async function test() {
    try {
        const cityId = 1;
        const destId = 2;
        const startDate = '2026-03-31';

        console.log("--- SQL 1: Simple City Check ---");
        const [r1] = await sequelize.query(`SELECT id, title, city_ids FROM treks WHERE JSON_CONTAINS(city_ids, '${cityId}', '$')`);
        console.log("JSON_CONTAINS results:", JSON.stringify(r1, null, 2));

        console.log("\n--- SQL 2: Full Query Check ---");
        const [r2] = await sequelize.query(`
            SELECT t.id, t.title 
            FROM treks t
            INNER JOIN batches b ON t.id = b.trek_id
            WHERE t.destination_id = ${destId}
              AND (JSON_CONTAINS(t.city_ids, ${cityId}, '$') OR JSON_CONTAINS(t.city_ids, '"${cityId}"', '$'))
              AND b.start_date >= '${startDate}'
              AND t.status = 'active'
              AND t.trek_status = 'approved'
        `);
        console.log("Full SQL results:", JSON.stringify(r2, null, 2));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

test();
