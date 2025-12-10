'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('banner_types', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: "Banner type name (e.g., Top Treks, What's New)"
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Brief description of this banner type"
      },
      card_width: {
        type: Sequelize.ENUM('fixed', 'fluid', 'responsive'),
        allowNull: false,
        defaultValue: 'fixed',
        comment: "Card width type for banner display"
      },
      card_height: {
        type: Sequelize.ENUM('fixed', 'auto', 'aspect-ratio'),
        allowNull: false,
        defaultValue: 'fixed',
        comment: "Card height type for banner display"
      },
      order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: "Display order for banner type"
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'inactive',
        comment: "Status of the banner type"
      },
      start_date: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "Start date for banner type visibility"
      },
      end_date: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "End date for banner type visibility"
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "Soft delete timestamp"
      }
    });

    // Add indexes for better performance
    await queryInterface.addIndex('banner_types', ['status']);
    await queryInterface.addIndex('banner_types', ['order']);
    await queryInterface.addIndex('banner_types', ['start_date']);
    await queryInterface.addIndex('banner_types', ['end_date']);
    await queryInterface.addIndex('banner_types', ['created_at']);
    await queryInterface.addIndex('banner_types', ['deleted_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('banner_types');
  }
};