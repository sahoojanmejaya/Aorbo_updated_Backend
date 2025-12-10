'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('banner_items', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      banner_type_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'banner_types',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: "Reference to the banner type this item belongs to"
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: "Title of the banner item"
      },
      subtitle: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: "Subtitle of the banner item"
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Description of the banner item"
      },
      description_main: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Main description of the banner item"
      },
      sub_description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Sub description of the banner item"
      },
      icon_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: "URL of the icon for the banner item"
      },
      img_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: "URL of the main image for the banner item"
      },
      background_type: {
        type: Sequelize.ENUM('solid', 'gradient', 'image'),
        allowNull: false,
        defaultValue: 'gradient',
        comment: "Type of background for the banner item"
      },
      text_color: {
        type: Sequelize.STRING(7),
        allowNull: false,
        defaultValue: '#FFFFFF',
        comment: "Hex color code for text color"
      },
      text_alignment: {
        type: Sequelize.ENUM('left', 'center', 'right'),
        allowNull: false,
        defaultValue: 'left',
        comment: "Text alignment for the banner item"
      },
      primary_color: {
        type: Sequelize.STRING(7),
        allowNull: false,
        defaultValue: '#1E90FF',
        comment: "Primary color for the banner item"
      },
      secondary_color: {
        type: Sequelize.STRING(7),
        allowNull: true,
        comment: "Secondary color for gradient backgrounds"
      },
      background_image: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: "URL of the background image"
      },
      button_text: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: 'View More',
        comment: "Text for the call-to-action button"
      },
      link_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: "URL for the call-to-action link"
      },
      priority: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: "Priority/order for displaying the banner item"
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
        comment: "Status of the banner item"
      },
      start_date: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "Start date for banner item visibility"
      },
      end_date: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "End date for banner item visibility"
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
    await queryInterface.addIndex('banner_items', ['banner_type_id']);
    await queryInterface.addIndex('banner_items', ['status']);
    await queryInterface.addIndex('banner_items', ['priority']);
    await queryInterface.addIndex('banner_items', ['start_date']);
    await queryInterface.addIndex('banner_items', ['end_date']);
    await queryInterface.addIndex('banner_items', ['created_at']);
    await queryInterface.addIndex('banner_items', ['deleted_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('banner_items');
  }
};