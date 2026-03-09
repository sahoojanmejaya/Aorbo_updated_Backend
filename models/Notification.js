module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define("Notification", {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    vendor_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true
    },
    customer_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true
    },
    notification_id: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM("EMAIL", "SMS", "PUSH"),
      allowNull: false
    },
    category: {
      type: DataTypes.ENUM("BOOKING", "DISPUTE", "PAYMENT", "SYSTEM", "CANCELLATION"),
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM("SENT", "DELIVERED", "FAILED", "PENDING"),
      defaultValue: "PENDING"
    }
  }, {
    tableName: "notifications",
    timestamps: true,
    underscored: true
  });

  return Notification;
};
