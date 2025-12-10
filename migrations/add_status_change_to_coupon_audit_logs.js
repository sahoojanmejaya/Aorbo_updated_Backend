'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // For MariaDB/MySQL, we need to modify the column directly
    // First check if the column exists and get its current definition
    try {
      const tableDescription = await queryInterface.describeTable('coupons_audit_logs');
      if (tableDescription.action) {
        // Modify the ENUM column to include the new value
        await queryInterface.changeColumn('coupons_audit_logs', 'action', {
          type: Sequelize.ENUM(
            'created',
            'updated', 
            'activated',
            'deactivated',
            'approved',
            'rejected',
            'assigned',
            'unassigned',
            'used',
            'expired',
            'deleted',
            'status_change'
          ),
          allowNull: false
        });
      }
    } catch (error) {
      console.log('Column might not exist or migration already applied:', error.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // For MariaDB/MySQL, revert the ENUM column to exclude the new value
    try {
      const tableDescription = await queryInterface.describeTable('coupons_audit_logs');
      if (tableDescription.action) {
        await queryInterface.changeColumn('coupons_audit_logs', 'action', {
          type: Sequelize.ENUM(
            'created',
            'updated', 
            'activated',
            'deactivated',
            'approved',
            'rejected',
            'assigned',
            'unassigned',
            'used',
            'expired',
            'deleted'
          ),
          allowNull: false
        });
      }
    } catch (error) {
      console.log('Column might not exist or migration not applied:', error.message);
    }
  }
};



