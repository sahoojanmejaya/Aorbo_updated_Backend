'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Update the default status for issue_reports table
    await queryInterface.changeColumn('issue_reports', 'status', {
      type: Sequelize.ENUM(
        "open",
        "pending", 
        "in_progress",
        "resolved",
        "closed"
      ),
      defaultValue: "pending",
      allowNull: false,
      comment: "Status of the issue report"
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to original default
    await queryInterface.changeColumn('issue_reports', 'status', {
      type: Sequelize.ENUM(
        "open",
        "pending",
        "in_progress", 
        "resolved",
        "closed"
      ),
      defaultValue: "open",
      allowNull: false,
      comment: "Status of the issue report"
    });
  }
};
