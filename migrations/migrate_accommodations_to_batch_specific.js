'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            console.log('Starting migration: Convert accommodations to batch-specific...');
            
            // Get all existing accommodations with their trek and batches
            const accommodationsQuery = `
                SELECT 
                    a.id as accommodation_id,
                    a.trek_id,
                    a.type,
                    a.details,
                    a.created_at,
                    a.updated_at,
                    b.id as batch_id
                FROM accommodations a
                INNER JOIN batches b ON b.trek_id = a.trek_id
                WHERE a.batch_id IS NULL
                ORDER BY a.id, b.id
            `;
            
            const results = await queryInterface.sequelize.query(accommodationsQuery, { 
                type: Sequelize.QueryTypes.SELECT,
                transaction 
            });
            
            console.log(`Found ${results.length} accommodation-batch combinations to create`);
            
            if (results.length === 0) {
                console.log('No accommodations to migrate - all already have batch_id assigned');
                await transaction.commit();
                return;
            }
            
            // Group by original accommodation ID
            const accommodationGroups = {};
            results.forEach(row => {
                if (!accommodationGroups[row.accommodation_id]) {
                    accommodationGroups[row.accommodation_id] = [];
                }
                accommodationGroups[row.accommodation_id].push(row);
            });
            
            console.log(`Found ${Object.keys(accommodationGroups).length} unique accommodations to replicate across batches`);
            
            // Track accommodations to delete (original ones without batch_id)
            const accommodationsToDelete = [];
            
            // Create batch-specific accommodations
            let insertedCount = 0;
            for (const [originalAccommodationId, batchRows] of Object.entries(accommodationGroups)) {
                // Track original for deletion
                accommodationsToDelete.push(originalAccommodationId);
                
                // Create one accommodation record for each batch
                for (const row of batchRows) {
                    const insertQuery = `
                        INSERT INTO accommodations (trek_id, batch_id, type, details, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `;
                    
                    await queryInterface.sequelize.query(insertQuery, {
                        replacements: [
                            row.trek_id,
                            row.batch_id,
                            row.type,
                            JSON.stringify(row.details),
                            row.created_at,
                            new Date()
                        ],
                        transaction
                    });
                    
                    insertedCount++;
                }
            }
            
            console.log(`Inserted ${insertedCount} batch-specific accommodation records`);
            
            // Delete original accommodations (those without batch_id)
            if (accommodationsToDelete.length > 0) {
                const deleteQuery = `
                    DELETE FROM accommodations 
                    WHERE id IN (${accommodationsToDelete.map(() => '?').join(',')})
                `;
                
                await queryInterface.sequelize.query(deleteQuery, {
                    replacements: accommodationsToDelete,
                    transaction
                });
                
                console.log(`Deleted ${accommodationsToDelete.length} original accommodation records`);
            }
            
            // Verify migration
            const verifyQuery = `
                SELECT 
                    COUNT(*) as total_accommodations,
                    COUNT(batch_id) as batch_specific_accommodations,
                    COUNT(CASE WHEN batch_id IS NULL THEN 1 END) as non_batch_specific
                FROM accommodations
            `;
            
            const [verification] = await queryInterface.sequelize.query(verifyQuery, { 
                type: Sequelize.QueryTypes.SELECT,
                transaction 
            });
            
            console.log('Migration verification:', verification);
            
            if (verification.non_batch_specific > 0) {
                throw new Error(`Migration incomplete: ${verification.non_batch_specific} accommodations still without batch_id`);
            }
            
            await transaction.commit();
            console.log('✅ Migration completed successfully!');
            
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Migration failed:', error);
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        console.log('⚠️  WARNING: Reverting this migration will lose batch-specific accommodation data!');
        console.log('This operation will consolidate all batch-specific accommodations back to trek-level only.');
        
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            // Group accommodations by trek and type, keeping only one per trek
            const consolidateQuery = `
                INSERT INTO accommodations (trek_id, type, details, created_at, updated_at)
                SELECT DISTINCT
                    trek_id,
                    type,
                    details,
                    MIN(created_at) as created_at,
                    NOW() as updated_at
                FROM accommodations 
                WHERE batch_id IS NOT NULL
                GROUP BY trek_id, type, details
            `;
            
            await queryInterface.sequelize.query(consolidateQuery, { transaction });
            
            // Delete all batch-specific accommodations
            await queryInterface.sequelize.query(
                'DELETE FROM accommodations WHERE batch_id IS NOT NULL',
                { transaction }
            );
            
            await transaction.commit();
            console.log('Migration reverted: Accommodations are now trek-level only');
            
        } catch (error) {
            await transaction.rollback();
            console.error('Failed to revert migration:', error);
            throw error;
        }
    }
};