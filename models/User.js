module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { isEmail: true },
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "password_hash",
      },
      roleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "role_id",
      },
        prefix: {
                type: DataTypes.STRING,
             
            },
      status: {
        type: DataTypes.ENUM("active", "inactive", "locked"),
        defaultValue: "active",
      },
    },
    {
      tableName: "users",
      underscored: true,
    }
  );

  // ✅ Associations
  User.associate = (models) => {
    User.belongsTo(models.Role, { foreignKey: "roleId", as: "role" });
    User.hasMany(models.Booking, { foreignKey: "user_id", as: "bookings" });
    User.hasOne(models.Vendor, { foreignKey: "user_id", as: "vendor" });
  User.hasMany(models.IssueReport, {
  foreignKey: "assigned_to",
  as: "assignedReports", 
});
    // ✅ TrekAuditLog association should go here
    User.hasMany(models.TrekAuditLog, {
      foreignKey: "vendor_id",
      as: "audit_logs",
    });
    User.hasMany(models.IssueReport, {
  foreignKey: "teamlead_id",
  as: "teamLeadReports"
});

  };

  return User;
};
