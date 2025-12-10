'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('coupons_audit_logs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      coupon_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'coupons',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      vendor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'vendors',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      action: {
        type: Sequelize.ENUM('create', 'update', 'delete', 'assign', 'unassign', 'reassign', 'expire', 'approve', 'reject'),
        allowNull: false
      },
      details: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'JSON string containing action-specific details'
      },
      previous_values: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'JSON string containing previous values for updates'
      },
      new_values: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'JSON string containing new values for updates'
      },
      trek_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'treks',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      previous_trek_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'treks',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true
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
      }
    });

    // Add indexes for better performance
    await queryInterface.addIndex('coupons_audit_logs', ['coupon_id']);
    await queryInterface.addIndex('coupons_audit_logs', ['vendor_id']);
    await queryInterface.addIndex('coupons_audit_logs', ['action']);
    await queryInterface.addIndex('coupons_audit_logs', ['created_at']);
    await queryInterface.addIndex('coupons_audit_logs', ['trek_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('coupons_audit_logs');
  }
};
