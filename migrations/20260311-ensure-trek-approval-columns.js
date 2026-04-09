'use strict';

/**
 * Migration: Ensure Trek approval columns are correct types with indexes
 *
 * - Ensures approved_at is DATETIME (not VARCHAR)
 * - Ensures approved_by is INT (not VARCHAR) — no FK constraint to avoid MySQL errors
 * - Ensures trek_status column exists with index
 * - Ensures rejected_reason column exists
 *
 * Safe to re-run: all operations are guarded by existence checks.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const table = await queryInterface.describeTable('treks');

      // ── approved_at ───────────────────────────────────────────────────
      if (table.approved_at) {
        // If it's not already a date type, change it
        if (!['DATE', 'DATETIME', 'TIMESTAMP'].includes(table.approved_at.type)) {
          await queryInterface.sequelize.query(
            `UPDATE treks SET approved_at = NULL WHERE approved_at IS NOT NULL AND approved_at NOT REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}'`,
            { transaction }
          );
          await queryInterface.changeColumn('treks', 'approved_at', {
            type: Sequelize.DATE,
            allowNull: true,
            comment: 'Timestamp when trek was approved by admin',
          }, { transaction });
        }
      } else {
        await queryInterface.addColumn('treks', 'approved_at', {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Timestamp when trek was approved by admin',
        }, { transaction });
      }

      // ── approved_by ───────────────────────────────────────────────────
      // Store as plain INT — no FK constraint to prevent MySQL errors.
      // Application code is responsible for storing a valid users.id.
      if (table.approved_by) {
        if (!['INT', 'INTEGER', 'INT(11)'].includes(table.approved_by.type?.toUpperCase?.() ?? '')) {
          await queryInterface.sequelize.query(
            `UPDATE treks SET approved_by = NULL WHERE approved_by IS NOT NULL AND approved_by NOT REGEXP '^[0-9]+$'`,
            { transaction }
          );
          await queryInterface.changeColumn('treks', 'approved_by', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Admin user ID (users.id) who approved the trek',
          }, { transaction });
        }
      } else {
        await queryInterface.addColumn('treks', 'approved_by', {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: 'Admin user ID (users.id) who approved the trek',
        }, { transaction });
      }

      // ── trek_status ───────────────────────────────────────────────────
      if (!table.trek_status) {
        await queryInterface.addColumn('treks', 'trek_status', {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: 'pending',
          comment: 'Approval workflow status: pending | approved | rejected',
        }, { transaction });
      }

      // ── rejected_reason ───────────────────────────────────────────────
      if (!table.rejected_reason) {
        await queryInterface.addColumn('treks', 'rejected_reason', {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Reason provided by admin when rejecting a trek',
        }, { transaction });
      }

      // ── Indexes (safe: catch if already exist) ────────────────────────
      const safeAddIndex = async (columns, name) => {
        try {
          await queryInterface.addIndex('treks', columns, { name, transaction });
        } catch (_) {
          // index already exists — skip
        }
      };

      await safeAddIndex(['trek_status'], 'idx_treks_trek_status');
      await safeAddIndex(['approved_at'], 'idx_treks_approved_at');
      await safeAddIndex(['approved_by'], 'idx_treks_approved_by');
      await safeAddIndex(['status', 'trek_status'], 'idx_treks_status_trek_status');

      await transaction.commit();
      console.log('✅ Trek approval columns migration completed.');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Trek approval columns migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      for (const name of [
        'idx_treks_trek_status',
        'idx_treks_approved_at',
        'idx_treks_approved_by',
        'idx_treks_status_trek_status',
      ]) {
        try { await queryInterface.removeIndex('treks', name, { transaction }); } catch (_) {}
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
