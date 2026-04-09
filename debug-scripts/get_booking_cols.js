const { sequelize } = require('./models');
const fs = require('fs');

async function getCols() {
    try {
        const [results] = await sequelize.query("DESCRIBE bookings");
        const cols = results.map(r => r.Field);
        fs.writeFileSync('booking_cols.json', JSON.stringify(cols, null, 2));
        console.log("Done");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

getCols();
