module.exports = (sequelize, DataTypes) => {
  const AssignTask = sequelize.define(
    "AssignTask",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      
      agent_id: {
        type: DataTypes.INTEGER,
      },
      teamlead_id: {
        type: DataTypes.INTEGER,
      },
      from_agent_id: {
        type: DataTypes.INTEGER,
      },
      issue_report_id: {
        type: DataTypes.INTEGER,
      },
      status: {
        type: DataTypes.STRING,
      },
      assign_status: {
        type: DataTypes.STRING,
      },
      is_available: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    }, 
    {
      tableName: "assign_task",
      underscored: true,
    }
  );
AssignTask.associate = (models) => {
    AssignTask.belongsTo(models.IssueReport, {
      foreignKey: "issue_report_id", 
      as: "issue",
    });
  };
  return AssignTask;
};

