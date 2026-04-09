const { Batch, Trek } = require("./models");

async function checkDates() {
    try {
        const batches = await Batch.findAll({
            where: { trek_id: [106, 107, 108] },
            include: [{ model: Trek, as: 'trek', attributes: ['title'] }],
            order: [['start_date', 'ASC']]
        });

        console.log('--- TREK BATCH DATES ---');
        batches.forEach(b => {
            console.log(`Trek: ${b.trek.title} (ID: ${b.trek_id}) | Batch ID: ${b.id} | Start: ${b.start_date} | End: ${b.end_date}`);
        });
        process.exit(0);
    } catch (error) {
        console.error("Error checking dates:", error);
        process.exit(1);
    }
}

checkDates();
