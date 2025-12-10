const { sequelize } = require("./models");

const fixTreksTbrId = async () => {
    try {
        console.log("🔧 Starting to fix treks tbr_id issue...");

        // Check if tbr_id column exists
        const tableDescription = await sequelize.getQueryInterface().describeTable("treks");
        const hasTbrId = tableDescription.tbr_id;

        if (!hasTbrId) {
            console.log("📝 Adding tbr_id column without constraints first...");
            await sequelize.getQueryInterface().addColumn("treks", "tbr_id", {
                type: sequelize.Sequelize.STRING(10),
                allowNull: true, // Allow null initially
                comment: "Trek Booking Record ID - auto-generated unique identifier",
            });
        }

        // Find treks with null or empty tbr_id
        const [treks] = await sequelize.query(
            'SELECT id FROM treks WHERE tbr_id IS NULL OR tbr_id = ""'
        );

        console.log(`🔍 Found ${treks.length} treks with empty tbr_id`);

        // Update each trek with a unique tbr_id
        for (const trek of treks) {
            const tbrId = `TBR${String(trek.id).padStart(6, "0")}`;
            
            await sequelize.query(
                "UPDATE treks SET tbr_id = ? WHERE id = ?",
                {
                    replacements: [tbrId, trek.id],
                    type: sequelize.QueryTypes.UPDATE,
                }
            );

            console.log(`✅ Updated trek ${trek.id} with tbr_id: ${tbrId}`);
        }

        // Now add constraints to tbr_id column
        console.log("🔒 Adding constraints to tbr_id column...");
        await sequelize.getQueryInterface().changeColumn("treks", "tbr_id", {
            type: sequelize.Sequelize.STRING(10),
            allowNull: false,
            unique: true,
        });

        console.log("✅ Successfully fixed treks tbr_id column!");

        // Verify the fix
        const [verification] = await sequelize.query(
            'SELECT COUNT(*) as count FROM treks WHERE tbr_id IS NULL OR tbr_id = ""'
        );

        if (verification[0].count === 0) {
            console.log("✅ Verification passed: No treks with empty tbr_id found");
        } else {
            console.log(`⚠️  Warning: ${verification[0].count} treks still have empty tbr_id`);
        }

    } catch (error) {
        console.error("❌ Error fixing treks tbr_id:", error);
    } finally {
        await sequelize.close();
    }
};

// Run the script if called directly
if (require.main === module) {
    fixTreksTbrId();
}

module.exports = { fixTreksTbrId }; 