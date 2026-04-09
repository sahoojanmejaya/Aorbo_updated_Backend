const { sequelize } = require('./models');

async function inspect() {
    try {
        const [results] = await sequelize.query("SELECT id, title, city_ids, HEX(city_ids) as hex_vals FROM treks WHERE id = 2");
        console.log("INSPECTION RESULTS:");
        console.log(JSON.stringify(results, null, 2));
        
        // Also check if it's stored as a string vs JSON
        if (results.length > 0) {
            const cityIds = results[0].city_ids;
            console.log("type of city_ids:", typeof cityIds);
            console.log("is array?", Array.isArray(cityIds));
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

inspect();
