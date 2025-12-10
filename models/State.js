module.exports = (sequelize, DataTypes) => {
    const State = sequelize.define(
        "State",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            status: {
                type: DataTypes.ENUM("active", "inactive"),
                allowNull: false,
                defaultValue: "active",
            },
        },
        {
            tableName: "states",
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            underscored: true,
        }
    );

    State.associate = (models) => {
        State.hasMany(models.City, {
            foreignKey: "stateId",
            as: "cities",
        });
    };

    return State;
};
