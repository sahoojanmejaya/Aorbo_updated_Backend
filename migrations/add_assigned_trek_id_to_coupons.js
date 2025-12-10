'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if column already exists
    const tableDescription = await queryInterface.describeTable('coupons');
    if (!tableDescription.assigned_trek_id) {
      await queryInterface.addColumn('coupons', 'assigned_trek_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'treks',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Specific trek this coupon is assigned to (null for general coupons)'
      });

      // Add index for better performance
      await queryInterface.addIndex('coupons', ['assigned_trek_id'], {
        name: 'idx_coupons_assigned_trek_id'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('coupons', 'idx_coupons_assigned_trek_id');
    await queryInterface.removeColumn('coupons', 'assigned_trek_id');
  }
};
