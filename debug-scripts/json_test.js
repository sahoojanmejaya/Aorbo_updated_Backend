const { sequelize } = require('./models');

async function test() {
    try {
        const [r1] = await sequelize.query("SELECT id FROM treks WHERE JSON_CONTAINS(city_ids, '\"1\"', '$')");
        const [r2] = await sequelize.query("SELECT id FROM treks WHERE JSON_CONTAINS(city_ids, 1, '$')");
        const [r3] = await sequelize.query("SELECT id FROM treks WHERE city_ids LIKE '%\"1\"%'");
        const [r4] = await sequelize.query("SELECT id FROM treks WHERE city_ids LIKE '%1%'");

        console.log({
            stringJSONMatch: r1.length,
            numberJSONMatch: r2.length,
            stringLikeMatch: r3.length,
            numberLikeMatch: r4.length
        });
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

test();
