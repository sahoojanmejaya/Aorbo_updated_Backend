const { sequelize } = require('../models');

async function addCityIdToBookings() {
    try {
        console.log('Starting migration: Adding city_id to bookings table...');
        
        // Add city_id column
        await sequelize.query(`
            ALTER TABLE bookings 
            ADD COLUMN city_id INTEGER,
            ADD CONSTRAINT fk_bookings_city 
            FOREIGN KEY (city_id) REFERENCES cities(id) 
            ON UPDATE CASCADE ON DELETE SET NULL
        `);
        
        // Add index for better performance
        await sequelize.query(`
            CREATE INDEX idx_bookings_city_id ON bookings(city_id)
        `);
        
        console.log('✅ Migration completed successfully!');
        console.log('Added city_id column to bookings table with foreign key constraint and index.');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        if (error.message.includes('duplicate column name')) {
            console.log('ℹ️  city_id column already exists, skipping...');
        } else {
            throw error;
        }
    } finally {
        await sequelize.close();
    }
}

// Run the migration
addCityIdToBookings().catch(console.error);
