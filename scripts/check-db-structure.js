const { sequelize } = require("../models");

async function checkDatabaseStructure() {
    try {
        console.log("🔍 Checking database structure...\n");

        // Check treks table
        console.log("📋 TREKS TABLE:");
        const treksColumns = await sequelize.query("DESCRIBE treks", {
            type: sequelize.QueryTypes.SELECT,
        });
        treksColumns.forEach((col) => {
            console.log(`  - ${col.Field} (${col.Type})`);
        });

        console.log("\n📋 BATCHES TABLE:");
        const batchesColumns = await sequelize.query("DESCRIBE batches", {
            type: sequelize.QueryTypes.SELECT,
        });
        batchesColumns.forEach((col) => {
            console.log(`  - ${col.Field} (${col.Type})`);
        });

        console.log("\n📋 TREK_IMAGES TABLE:");
        const trekImagesColumns = await sequelize.query(
            "DESCRIBE trek_images",
            { type: sequelize.QueryTypes.SELECT }
        );
        trekImagesColumns.forEach((col) => {
            console.log(`  - ${col.Field} (${col.Type})`);
        });

        console.log("\n📋 TREK_STAGES TABLE:");
        const trekStagesColumns = await sequelize.query(
            "DESCRIBE trek_stages",
            { type: sequelize.QueryTypes.SELECT }
        );
        trekStagesColumns.forEach((col) => {
            console.log(`  - ${col.Field} (${col.Type})`);
        });

        console.log("\n✅ Database structure check completed!");
    } catch (error) {
        console.error("❌ Error checking database structure:", error);
    } finally {
        await sequelize.close();
    }
}

checkDatabaseStructure();
