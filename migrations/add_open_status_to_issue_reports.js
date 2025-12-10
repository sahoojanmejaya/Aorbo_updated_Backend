'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Add 'open' to the status enum in issue_reports table
        await queryInterface.sequelize.query(`
            ALTER TABLE issue_reports 
            MODIFY COLUMN status ENUM('open', 'pending', 'in_progress', 'resolved', 'closed') 
            DEFAULT 'open'
        `);
        
        // Update existing records with 'pending' status to 'open'
        await queryInterface.sequelize.query(`
            UPDATE issue_reports 
            SET status = 'open' 
            WHERE status = 'pending'
        `);
    },

    down: async (queryInterface, Sequelize) => {
        // Revert existing 'open' records back to 'pending'
        await queryInterface.sequelize.query(`
            UPDATE issue_reports 
            SET status = 'pending' 
            WHERE status = 'open'
        `);
        
        // Remove 'open' from the status enum
        await queryInterface.sequelize.query(`
            ALTER TABLE issue_reports 
            MODIFY COLUMN status ENUM('pending', 'in_progress', 'resolved', 'closed') 
            DEFAULT 'pending'
        `);
    }
};
