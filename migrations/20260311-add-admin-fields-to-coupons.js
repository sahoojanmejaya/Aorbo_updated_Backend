'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // 1. Add scope column
        await queryInterface.addColumn('coupons', 'scope', {
            type: Sequelize.ENUM('PLATFORM', 'NORMAL', 'SPECIAL', 'PREMIUM', 'INFLUENCER'),
            allowNull: false,
            defaultValue: 'NORMAL',
            comment: 'Admin-defined coupon scope/category',
        });

        // 2. Add config column (JSON blob for influencer details, commission, etc.)
        await queryInterface.addColumn('coupons', 'config', {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: 'JSON-serialised extended config (influencer, commission, tier rules etc.)',
        });

        // 3. Add per_user_limit column
        await queryInterface.addColumn('coupons', 'per_user_limit', {
            type: Sequelize.INTEGER,
            allowNull: true,
            defaultValue: 1,
            comment: 'Max times a single user can use this coupon (0 = unlimited)',
        });

        // 4. Add target_vendor_ids column
        await queryInterface.addColumn('coupons', 'target_vendor_ids', {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: 'JSON array of vendor IDs this coupon is restricted to (for SPECIAL scope)',
        });

        // 5. Make vendor_id nullable so admin can create platform-level coupons without a vendor
        await queryInterface.changeColumn('coupons', 'vendor_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: 'vendors', key: 'id' },
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
        });

        // 6. Make vendor_id nullable in audit logs so admin actions can be recorded
        await queryInterface.changeColumn('coupons_audit_logs', 'vendor_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: 'vendors', key: 'id' },
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('coupons', 'scope');
        await queryInterface.removeColumn('coupons', 'config');
        await queryInterface.removeColumn('coupons', 'per_user_limit');
        await queryInterface.removeColumn('coupons', 'target_vendor_ids');

        await queryInterface.changeColumn('coupons', 'vendor_id', {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'vendors', key: 'id' },
        });

        await queryInterface.changeColumn('coupons_audit_logs', 'vendor_id', {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'vendors', key: 'id' },
        });
    },
};
