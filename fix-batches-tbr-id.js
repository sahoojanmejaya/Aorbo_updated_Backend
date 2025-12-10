const { sequelize } = require("./models");
const { DataTypes } = require("sequelize");

const fixBatchesTbrId = async () => {
    try {
        console.log("🔧 Starting to fix batches tbr_id issue...");

        // Check if tbr_id column exists
        const tableDescription = await sequelize
            .getQueryInterface()
            .describeTable("batches");
        const hasTbrId = tableDescription.tbr_id;

        if (!hasTbrId) {
            console.log("📝 Adding tbr_id column...");
            // Add the column without constraints first
            await sequelize.getQueryInterface().addColumn("batches", "tbr_id", {
                type: DataTypes.STRING(10),
                allowNull: true,
                comment:
                    "Trek Booking Record ID - auto-generated unique identifier",
            });
        }

        // Find batches with null or empty tbr_id
        const batches = await sequelize.query(
            'SELECT id FROM batches WHERE tbr_id IS NULL OR tbr_id = ""',
            { type: sequelize.QueryTypes.SELECT }
        );

        console.log(`🔍 Found ${batches.length} batches with empty tbr_id`);

        // Update each batch with a unique tbr_id
        for (const batch of batches) {
            const tbrId = `TBR${String(batch.id).padStart(6, "0")}`;
            await sequelize.query(
                "UPDATE batches SET tbr_id = ? WHERE id = ?",
                {
                    replacements: [tbrId, batch.id],
                    type: sequelize.QueryTypes.UPDATE,
                }
            );
            console.log(`✅ Updated batch ${batch.id} with tbr_id: ${tbrId}`);
        }

        // Now add the constraints
        console.log("🔒 Adding constraints to tbr_id column...");
        await sequelize.getQueryInterface().changeColumn("batches", "tbr_id", {
            type: DataTypes.STRING(10),
            allowNull: false,
            unique: true,
            comment:
                "Trek Booking Record ID - auto-generated unique identifier",
        });

        console.log("✅ Successfully fixed batches tbr_id column!");

        // Verify the fix
        const verification = await sequelize.query(
            'SELECT COUNT(*) as count FROM batches WHERE tbr_id IS NULL OR tbr_id = ""',
            { type: sequelize.QueryTypes.SELECT }
        );

        if (verification[0].count === 0) {
            console.log(
                "✅ Verification passed: No batches with empty tbr_id found"
            );
        } else {
            console.log(
                `⚠️  Warning: ${verification[0].count} batches still have empty tbr_id`
            );
        }
    } catch (error) {
        console.error("❌ Error fixing batches tbr_id:", error);
        throw error;
    }
};

// Run if called directly
if (require.main === module) {
    fixBatchesTbrId()
        .then(() => {
            console.log("🎉 Fix completed successfully!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("💥 Fix failed:", error);
            process.exit(1);
        });
}

module.exports = { fixBatchesTbrId };
