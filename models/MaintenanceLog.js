module.exports = (sequelize, DataTypes) => {
    const MaintenanceLog = sequelize.define(
        "MaintenanceLog",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            message: { type: DataTypes.TEXT, allowNull: false },
            is_active: { type: DataTypes.BOOLEAN, defaultValue: false },
            start_date: { type: DataTypes.DATE, allowNull: false },
            end_date: { type: DataTypes.DATE, allowNull: true },
        },
        {
            tableName: "maintenance_logs",
            underscored: true,
            timestamps: true,
        }
    );

    return MaintenanceLog;
};
