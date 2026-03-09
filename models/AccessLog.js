module.exports = (sequelize, DataTypes) => {
  const AccessLog = sequelize.define(
    "AccessLog",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      vendor_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },

       last_ip: {
        type: DataTypes.STRING,
        allowNull: false,
      },

       last_locations: {
        type: DataTypes.STRING,
        allowNull: false,
      },

       logout_time: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      

       performedByName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("success", "failed", "warning", "info"),
        defaultValue: "info",
      },
      access_time: {
        type: DataTypes.TIME,
        allowNull: false,
      },
      created_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
    },
    {
      tableName: "access_logs",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return AccessLog;
};
