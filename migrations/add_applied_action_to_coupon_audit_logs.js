'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add 'applied' to the action enum
    await queryInterface.sequelize.query(`
      ALTER TABLE coupons_audit_logs 
      MODIFY COLUMN action ENUM('create', 'update', 'delete', 'assign', 'unassign', 'reassign', 'expire', 'approve', 'reject', 'applied') 
      NOT NULL
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove 'applied' from the action enum
    await queryInterface.sequelize.query(`
      ALTER TABLE coupons_audit_logs 
      MODIFY COLUMN action ENUM('create', 'update', 'delete', 'assign', 'unassign', 'reassign', 'expire', 'approve', 'reject') 
      NOT NULL
    `);
  }
};
