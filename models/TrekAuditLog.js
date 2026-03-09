// models/TrekAuditLog.js
module.exports = (sequelize, DataTypes) => {
  const TrekAuditLog = sequelize.define(
    "TrekAuditLog",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      vendor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      trek_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      current_status: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      target_entity: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      details: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "trek_audit_logs",
      timestamps: true,      // created_at & updated_at
      underscored: true,     // snake_case for timestamps
    }
  );

  // ✅ Associations
  TrekAuditLog.associate = (models) => {
    // vendor_id linked to User
    TrekAuditLog.belongsTo(models.User, {
      foreignKey: "vendor_id",
      as: "vendor", // must match controller include
    });

    // trek_id linked to Trek
    TrekAuditLog.belongsTo(models.Trek, {
      foreignKey: "trek_id",
      as: "trek",
    });
  };

  return TrekAuditLog;
};
