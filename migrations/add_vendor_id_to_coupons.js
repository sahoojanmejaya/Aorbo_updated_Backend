const { DataTypes } = require('sequelize');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            console.log('Adding vendor_id foreign key to coupons table...');
            
            // Check if vendor_id column already exists
            const tableDescription = await queryInterface.describeTable('coupons', { transaction });
            
            if (!tableDescription.vendor_id) {
                // Add vendor_id column
                await queryInterface.addColumn('coupons', 'vendor_id', {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: { 
                        model: 'vendors', 
                        key: 'id' 
                    },
                    onDelete: 'CASCADE',
                    onUpdate: 'CASCADE',
                    comment: 'Reference to the vendor who created this coupon'
                }, { transaction });
                
                console.log('vendor_id column added to coupons table');
                
                // Add index for better query performance
                await queryInterface.addIndex('coupons', ['vendor_id'], {
                    name: 'coupons_vendor_id_idx'
                }, { transaction });
                
                console.log('Index added for vendor_id column');
                
            } else {
                console.log('vendor_id column already exists in coupons table, skipping...');
            }

            await transaction.commit();
            console.log('Migration completed successfully!');
            
        } catch (error) {
            await transaction.rollback();
            console.error('Migration failed:', error);
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            console.log('Rolling back vendor_id addition to coupons table...');
            
            // Remove the index first
            try {
                await queryInterface.removeIndex('coupons', 'coupons_vendor_id_idx', { transaction });
                console.log('Index removed successfully');
            } catch (error) {
                console.log('Index does not exist, continuing...');
            }
            
            // Remove the foreign key constraint
            try {
                await queryInterface.removeConstraint('coupons', 'coupons_vendor_id_fkey', { transaction });
                console.log('Foreign key constraint removed successfully');
            } catch (error) {
                console.log('Foreign key constraint does not exist, continuing...');
            }
            
            // Remove the vendor_id column
            try {
                await queryInterface.removeColumn('coupons', 'vendor_id', { transaction });
                console.log('vendor_id column removed from coupons table');
            } catch (error) {
                console.log('vendor_id column does not exist, continuing...');
            }

            await transaction.commit();
            console.log('Rollback completed successfully!');
            
        } catch (error) {
            await transaction.rollback();
            console.error('Rollback failed:', error);
            throw error;
        }
    }
};
