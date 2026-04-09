'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        try {
            const couponTable = await queryInterface.describeTable('coupons');

            // 1. Add deleted_at to coupons for soft deletes (guard if already exists)
            if (!couponTable.deleted_at) {
                await queryInterface.addColumn('coupons', 'deleted_at', {
                    type: Sequelize.DATE,
                    allowNull: true,
                }, { transaction });
            }

            // 2. Add indexes to coupons (safe: skip if already exist)
            const safeAddIndex = async (table, columns, opts) => {
                try {
                    await queryInterface.addIndex(table, columns, { ...opts, transaction });
                } catch (_) { /* index already exists — skip */ }
            };

            await safeAddIndex('coupons', ['code'], { name: 'coupons_code_idx', unique: true });
            await safeAddIndex('coupons', ['vendor_id'], { name: 'coupons_vendor_id_idx' });
            await safeAddIndex('coupons', ['status'], { name: 'coupons_status_idx' });
            await safeAddIndex('coupons', ['approval_status'], { name: 'coupons_approval_status_idx' });

            // 3. Add unique index to coupon_assignments (skip if duplicates exist)
            const existingIndexes = await queryInterface.showIndex('coupon_assignments');
            const hasUniqueIndex = existingIndexes.some(idx => idx.name === 'coupon_assignments_unique_idx');
            if (!hasUniqueIndex) {
                try {
                    await queryInterface.addIndex('coupon_assignments', ['coupon_id', 'customer_id'], {
                        name: 'coupon_assignments_unique_idx',
                        unique: true,
                        transaction
                    });
                } catch (indexError) {
                    console.warn("Could not add unique index on coupon_assignments, duplicates may exist.");
                }
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        try {
            await queryInterface.removeIndex('coupon_assignments', 'coupon_assignments_unique_idx', { transaction });
            await queryInterface.removeIndex('coupons', 'coupons_approval_status_idx', { transaction });
            await queryInterface.removeIndex('coupons', 'coupons_status_idx', { transaction });
            await queryInterface.removeIndex('coupons', 'coupons_vendor_id_idx', { transaction });
            await queryInterface.removeIndex('coupons', 'coupons_code_idx', { transaction });
            await queryInterface.removeColumn('coupons', 'deleted_at', { transaction });

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
};
