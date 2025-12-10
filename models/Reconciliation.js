module.exports = (sequelize, DataTypes) => {
    const Reconciliation = sequelize.define(
        "Reconciliation",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            period_start: { type: DataTypes.DATEONLY, allowNull: false },
            period_end: { type: DataTypes.DATEONLY, allowNull: false },
            total_bookings: { type: DataTypes.INTEGER, allowNull: false },
            total_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
            status: {
                type: DataTypes.ENUM("pending", "completed"),
                defaultValue: "pending",
            },
        },
        {
            tableName: "reconciliations",
            underscored: true,
        }
    );

    return Reconciliation;
};
