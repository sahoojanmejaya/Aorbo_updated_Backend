const { Trek, City } = require("./models");

async function checkCities() {
    try {
        const treks = await Trek.findAll({ where: { id: [106, 107, 108] } });
        const cities = await City.findAll({ attributes: ['id', 'cityName'] });
        const cityMap = {};
        cities.forEach(c => cityMap[c.id] = c.cityName);

        treks.forEach(t => {
            let ids = typeof t.city_ids === 'string' ? JSON.parse(t.city_ids) : t.city_ids;
            let names = ids.map(id => cityMap[id] || id).join(',');
            console.log(`${t.id}:${names}`);
        });
        process.exit(0);
    } catch (error) {
        process.exit(1);
    }
}
checkCities();
