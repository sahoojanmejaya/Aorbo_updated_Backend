module.exports = (sequelize, DataTypes) => {
    const Destination = sequelize.define(
        "Destination",
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
            state: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            isPopular: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                field: "is_popular",
            },
            status: {
                type: DataTypes.ENUM("active", "inactive", "planning"),
                allowNull: false,
                defaultValue: "active",
            },
        },
        {
            tableName: "destinations",
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            underscored: true,
        }
    );

    Destination.associate = (models) => {
        Destination.hasMany(models.Trek, {
            foreignKey: "destination_id",
            as: "treks",
        });
    };

    return Destination;
};
