module.exports = (sequelize, DataTypes) => {
    const TrekStage = sequelize.define(
        "TrekStage",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            trek_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "treks", key: "id" },
            },
            batch_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "batches", key: "id" },
                comment: "Reference to the specific batch for this stage",
            },
            stage_name: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: "Name of the trek stage",
            },
            destination: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "Destination or location for this trek stage",
            },
            means_of_transport: {
                type: DataTypes.STRING,
                allowNull: true,
                comment:
                    "Means of transport for this trek stage (e.g., walking, bus, train, flight, etc.)",
            },
            date_time: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "Full date and time for the stage (e.g., '2024-08-26 10:30 AM')",
            },
            is_boarding_point: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: "Indicates if this stage is a boarding point",
            },
            city_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "cities", key: "id" },
                comment: "Reference to the city for boarding point stages",
            },
        },
        {
            tableName: "trek_stages",
            underscored: true,
        }
    );

    TrekStage.associate = (models) => {
        TrekStage.belongsTo(models.Trek, {
            foreignKey: "trek_id",
            as: "trek",
        });

        TrekStage.belongsTo(models.Batch, {
            foreignKey: "batch_id",
            as: "batch",
        });

        TrekStage.belongsTo(models.City, {
            foreignKey: "city_id",
            as: "city",
        });
    };

    return TrekStage;
};
