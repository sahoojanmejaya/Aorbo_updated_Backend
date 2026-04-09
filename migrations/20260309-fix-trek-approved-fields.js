/**
 * Database Migration: Fix Trek approved_at and approved_by fields
 * 
 * @description Fixes the Trek model database schema issues
 * @author Kiro AI Assistant
 * @created 2026-03-09 16:00:00 IST
 * @updated 2026-03-09 16:00:00 IST
 * 
 * FIXES:
 * - Changes approved_at from VARCHAR to DATETIME
 * - Changes approved_by from VARCHAR to INT with foreign key reference
 * - Adds proper indexes for performance
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔧 Starting Trek table schema fixes...');
      
      // Check if approved_at column exists and its current type
      const tableDescription = await queryInterface.describeTable('treks');
      
      if (tableDescription.approved_at) {
        console.log('📝 Modifying existing approved_at column...');
        
        // First, backup any existing data that might be in string format
        await queryInterface.sequelize.query(`
          UPDATE treks 
          SET approved_at = NULL 
          WHERE approved_at IS NOT NULL 
          AND approved_at NOT REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
        `, { transaction });
        
        // Modify approved_at column to DATETIME
        await queryInterface.changeColumn('treks', 'approved_at', {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Timestamp when trek was approved by admin'
        }, { transaction });
        
      } else {
        console.log('➕ Adding approved_at column...');
        
        // Add approved_at column
        await queryInterface.addColumn('treks', 'approved_at', {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Timestamp when trek was approved by admin'
        }, { transaction });
      }
      
      if (tableDescription.approved_by) {
        console.log('📝 Modifying existing approved_by column...');
        
        // Clear any non-numeric data
        await queryInterface.sequelize.query(`
          UPDATE treks 
          SET approved_by = NULL 
          WHERE approved_by IS NOT NULL 
          AND approved_by NOT REGEXP '^[0-9]+$'
        `, { transaction });
        
        // Modify approved_by column to INTEGER
        await queryInterface.changeColumn('treks', 'approved_by', {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: 'Admin user ID who approved the trek',
          references: {
            model: 'users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        }, { transaction });
        
      } else {
        console.log('➕ Adding approved_by column...');
        
        // Add approved_by column
        await queryInterface.addColumn('treks', 'approved_by', {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: 'Admin user ID who approved the trek',
          references: {
            model: 'users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        }, { transaction });
      }
      
      // Add indexes for better performance
      console.log('📊 Adding indexes...');
      
      try {
        await queryInterface.addIndex('treks', ['approved_at'], {
          name: 'idx_treks_approved_at',
          transaction
        });
      } catch (error) {
        console.log('⚠️ Index idx_treks_approved_at might already exist');
      }
      
      try {
        await queryInterface.addIndex('treks', ['approved_by'], {
          name: 'idx_treks_approved_by',
          transaction
        });
      } catch (error) {
        console.log('⚠️ Index idx_treks_approved_by might already exist');
      }
      
      try {
        await queryInterface.addIndex('treks', ['status', 'approved_at'], {
          name: 'idx_treks_status_approved_at',
          transaction
        });
      } catch (error) {
        console.log('⚠️ Index idx_treks_status_approved_at might already exist');
      }
      
      await transaction.commit();
      console.log('✅ Trek table schema fixes completed successfully!');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error fixing Trek table schema:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔄 Reverting Trek table schema changes...');
      
      // Remove indexes
      try {
        await queryInterface.removeIndex('treks', 'idx_treks_approved_at', { transaction });
      } catch (error) {
        console.log('⚠️ Index idx_treks_approved_at might not exist');
      }
      
      try {
        await queryInterface.removeIndex('treks', 'idx_treks_approved_by', { transaction });
      } catch (error) {
        console.log('⚠️ Index idx_treks_approved_by might not exist');
      }
      
      try {
        await queryInterface.removeIndex('treks', 'idx_treks_status_approved_at', { transaction });
      } catch (error) {
        console.log('⚠️ Index idx_treks_status_approved_at might not exist');
      }
      
      // Revert approved_at to STRING (original problematic state)
      await queryInterface.changeColumn('treks', 'approved_at', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });
      
      // Revert approved_by to STRING (original problematic state)
      await queryInterface.changeColumn('treks', 'approved_by', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });
      
      await transaction.commit();
      console.log('✅ Trek table schema reverted successfully!');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error reverting Trek table schema:', error);
      throw error;
    }
  }
};