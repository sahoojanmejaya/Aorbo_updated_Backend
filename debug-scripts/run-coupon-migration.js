const { sequelize } = require('./models');
const migration = require('./migrations/20260310-add-coupon-indexes-and-softdelete');

async function runMigration() {
    try {
        console.log('🚀 Starting Coupon schema migration...');

        // Test database connection
        await sequelize.authenticate();
        console.log('✅ Database connection established');

        // Run the migration
        await migration.up(sequelize.getQueryInterface(), sequelize.constructor);

        console.log('🎉 Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('📋 Error details:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

runMigration();
