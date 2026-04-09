const { sequelize } = require('./models');

async function check() {
    try {
        const [results] = await sequelize.query("SELECT id, title, status, trek_status FROM treks LIMIT 10");
        console.log("RAW TREKS IN DB:");
        console.log(JSON.stringify(results, null, 2));
        
        const [batchCols] = await sequelize.query("SHOW COLUMNS FROM batches");
        console.log("\nBATCHES COLUMNS:");
        console.log(JSON.stringify(batchCols, null, 2));

        const [constraints] = await sequelize.query("SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = 'batches'");
        console.log("\nBATCHES CONSTRAINTS:");
        console.log(JSON.stringify(constraints, null, 2));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
