const { Trek } = require('./models');

async function list() {
    try {
        const treks = await Trek.findAll({ attributes: ['id', 'title'] });
        console.log("ALL TREKS:");
        treks.forEach(t => console.group(`- ID: ${t.id}, Title: ${t.title}`));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

list();
