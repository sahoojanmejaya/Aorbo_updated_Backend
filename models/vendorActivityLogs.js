'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('vendor_activity_logs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },

      vendor_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },

      performed_datetime: {
        type: Sequelize.DATE,
        allowNull: false
      },

      performed_by: {
        type: Sequelize.STRING,
        allowNull: true
      },

      action: {
        type: Sequelize.STRING,
        allowNull: true
      },

      reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      details: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      status: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },

      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('vendor_activity_logs');
  }
};