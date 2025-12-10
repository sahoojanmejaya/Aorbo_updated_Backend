const { sequelize } = require('./models');

(async () => {
  try {
    console.log('🔧 Cleaning up duplicate indexes in customers table...');
    
    // Remove duplicate indexes
    const duplicateIndexes = [
      'phone_2', 'phone_3', 'phone_4',
      'email_2', 'email_3', 'email_4',
      'firebase_uid_2', 'firebase_uid_3', 'firebase_uid_4'
    ];
    
    for (const indexName of duplicateIndexes) {
      try {
        await sequelize.query(`DROP INDEX \`${indexName}\` ON customers`);
        console.log(`✅ Dropped duplicate index: ${indexName}`);
      } catch (err) {
        if (err.message.includes("doesn't exist") || err.message.includes("check that it exists")) {
          console.log(`ℹ️  Index ${indexName} doesn't exist, skipping...`);
        } else {
          console.log(`⚠️  Error dropping index ${indexName}:`, err.message);
        }
      }
    }
    
    console.log('✅ Cleanup completed!');
    
    // Check remaining indexes
    const [results] = await sequelize.query('SHOW INDEX FROM customers');
    console.log(`\n📊 Remaining indexes: ${results.length}`);
    results.forEach((index, i) => {
      console.log(`${i+1}. ${index.Key_name} - ${index.Column_name} - ${index.Non_unique ? 'Non-unique' : 'Unique'}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();





