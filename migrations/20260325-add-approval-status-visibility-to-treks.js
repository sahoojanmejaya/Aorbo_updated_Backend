'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('treks');

    if (!table.approval_status) {
      await queryInterface.addColumn('treks', 'approval_status', {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Admin approval status: pending | approved | rejected',
      });
    }

    if (!table.visibility) {
      await queryInterface.addColumn('treks', 'visibility', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Admin controlled visibility flag',
      });
    }

    // Sync existing approved treks so they are visible
    await queryInterface.sequelize.query(`
      UPDATE treks
      SET approval_status = 'approved', visibility = true
      WHERE trek_status = 'approved' AND status = 'active'
    `);

    await queryInterface.sequelize.query(`
      UPDATE treks
      SET approval_status = 'rejected', visibility = false
      WHERE trek_status = 'rejected'
    `);
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('treks');
    if (table.visibility) {
      await queryInterface.removeColumn('treks', 'visibility');
    }
    if (table.approval_status) {
      await queryInterface.removeColumn('treks', 'approval_status');
    }
  },
};
