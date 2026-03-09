module.exports = (sequelize, DataTypes) => {
  const CommissionSector = sequelize.define(
    "CommissionSector",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      sector_type: {
        type: DataTypes.ENUM("HIGH", "MEDIUM", "LOW"),
        allowNull: false,
      },
      platform_commission: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
      },
      start_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      end_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      quick_range_months: {
        type: DataTypes.INTEGER,
        allowNull: true, // 3,6,9,12
      },
      status: {
        type: DataTypes.ENUM("ACTIVE", "LOCKED"),
        defaultValue: "ACTIVE",
      },
    },
    {
      tableName: "commission_sectors",
      timestamps: true,
      underscored: true,
    }
  );

  return CommissionSector;
};
