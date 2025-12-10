module.exports = (sequelize, DataTypes) => {
    const WeatherLog = sequelize.define(
        "WeatherLog",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            cityId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                field: "city_id",
                references: {
                    model: "cities",
                    key: "id",
                },
            },
            trekId: {
                type: DataTypes.INTEGER,
                field: "trek_id",
                references: {
                    model: "treks",
                    key: "id",
                },
            },
            date: {
                type: DataTypes.DATEONLY,
                allowNull: false,
            },
            temperature: {
                type: DataTypes.JSON, // {min: number, max: number, current: number}
                allowNull: false,
            },
            humidity: {
                type: DataTypes.INTEGER, // Percentage
                defaultValue: 0,
            },
            windSpeed: {
                type: DataTypes.DECIMAL(5, 2), // km/h
                field: "wind_speed",
                defaultValue: 0,
            },
            windDirection: {
                type: DataTypes.STRING, // N, NE, E, SE, S, SW, W, NW
                field: "wind_direction",
            },
            precipitation: {
                type: DataTypes.DECIMAL(5, 2), // mm
                defaultValue: 0,
            },
            visibility: {
                type: DataTypes.DECIMAL(5, 2), // km
                defaultValue: 10,
            },
            weatherCondition: {
                type: DataTypes.ENUM(
                    "sunny",
                    "cloudy",
                    "rainy",
                    "snowy",
                    "foggy",
                    "stormy"
                ),
                field: "weather_condition",
                allowNull: false,
            },
            uvIndex: {
                type: DataTypes.INTEGER,
                field: "uv_index",
                defaultValue: 0,
            },
            airQuality: {
                type: DataTypes.ENUM(
                    "good",
                    "moderate",
                    "unhealthy",
                    "hazardous"
                ),
                field: "air_quality",
                defaultValue: "good",
            },
            trekSuitability: {
                type: DataTypes.ENUM(
                    "excellent",
                    "good",
                    "fair",
                    "poor",
                    "dangerous"
                ),
                field: "trek_suitability",
                allowNull: false,
            },
            alerts: {
                type: DataTypes.JSON, // Array of weather alerts
                defaultValue: [],
            },
            source: {
                type: DataTypes.STRING, // API source or manual
                defaultValue: "manual",
            },
        },
        {
            tableName: "weather_logs",
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
            underscored: true,
        }
    );

    WeatherLog.associate = (models) => {
        WeatherLog.belongsTo(models.City, {
            foreignKey: "cityId",
            as: "city",
        });
        WeatherLog.belongsTo(models.Trek, {
            foreignKey: "trekId",
            as: "trek",
        });
    };

    return WeatherLog;
};
