module.exports = (sequelize, DataTypes) => {
  const VendorActivityLogs = sequelize.define(
    "VendorActivityLogs",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },

      vendor_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },

      performed_datetime: {
        type: DataTypes.DATE,
        allowNull: false
      },

      performed_by: DataTypes.STRING,
      action: DataTypes.STRING,
      reason: DataTypes.TEXT,
      details: DataTypes.TEXT,

      status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },

      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    },
    {
      tableName: "vendor_activity_logs",
      timestamps: false
    }
  );

  return VendorActivityLogs;
};