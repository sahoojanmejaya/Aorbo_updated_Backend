const { sequelize } = require('./models');

async function inspect() {
    try {
        const [results] = await sequelize.query("SELECT id, title, status, trek_status, destination_id, city_ids FROM treks WHERE id = 107");
        console.log("TREK 107 RAW:");
        console.log(JSON.stringify(results, null, 2));

        const [batches] = await sequelize.query("SELECT id, start_date FROM batches WHERE trek_id = 107");
        console.log("\nBATCHES for 107:");
        console.log(JSON.stringify(batches, null, 2));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

inspect();
