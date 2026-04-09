/**
 * Migration Runner Script
 * 
 * @description Runs the Trek schema fix migration
 * @author Kiro AI Assistant
 * @created 2026-03-09 16:02:00 IST
 * @updated 2026-03-09 16:02:00 IST
 * 
 * Usage: node run-migration.js
 */

const { sequelize } = require('./models');
const migration = require('./migrations/20260309-fix-trek-approved-fields');

async function runMigration() {
    try {
        console.log('🚀 Starting Trek schema migration...');
        console.log('📅 Timestamp:', new Date().toISOString());
        
        // Test database connection
        await sequelize.authenticate();
        console.log('✅ Database connection established');
        
        // Run the migration
        await migration.up(sequelize.getQueryInterface(), sequelize.constructor);
        
        console.log('🎉 Migration completed successfully!');
        console.log('📋 Summary:');
        console.log('   - Fixed approved_at column (STRING → DATE)');
        console.log('   - Fixed approved_by column (STRING → INTEGER with FK)');
        console.log('   - Added performance indexes');
        console.log('   - Added proper foreign key constraints');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('📋 Error details:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
        console.log('🔌 Database connection closed');
        process.exit(0);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run the migration
runMigration();