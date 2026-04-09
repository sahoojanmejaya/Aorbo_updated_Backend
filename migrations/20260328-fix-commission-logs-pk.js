'use strict';

/**
 * Force commission_logs.id to INT AUTO_INCREMENT.
 * The previous recreate migration may not have run or may have been skipped.
 * This migration directly alters the id column via raw SQL.
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        const desc = await queryInterface.describeTable('commission_logs');

        // If id is already INTEGER with autoIncrement, nothing to do
        if (desc.id && desc.id.autoIncrement) {
            console.log('commission_logs.id already has AUTO_INCREMENT — skipping');
            return;
        }

        // Drop all existing rows so we can safely change the PK type
        await queryInterface.sequelize.query('DELETE FROM commission_logs;');
        console.log('Cleared commission_logs rows');

        // Alter id column to INT AUTO_INCREMENT
        await queryInterface.sequelize.query(
            'ALTER TABLE commission_logs MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;'
        );
        console.log('commission_logs.id is now INT AUTO_INCREMENT');
    },

    async down() {
        // Intentionally a no-op — reverting AUTO_INCREMENT is destructive
    },
};
