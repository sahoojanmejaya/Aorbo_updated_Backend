module.exports = (sequelize, DataTypes) => {
    const Batch = sequelize.define(
        "Batch",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            tbr_id: {
                type: DataTypes.STRING(10),
                allowNull: false,
                unique: true,
                comment:
                    "Trek Booking Record ID - auto-generated unique identifier",
                defaultValue: function () {
                    // Generate TBR ID: TBR + 2-digit timestamp + 5 random characters
                    const timestamp = Date.now().toString().slice(-2);
                    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                    let random = "";
                    for (let i = 0; i < 5; i++) {
                        random += chars.charAt(
                            Math.floor(Math.random() * chars.length)
                        );
                    }
                    return `TBR${timestamp}${random}`;
                },
            },
            trek_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "treks", key: "id" },
            },
            start_date: { type: DataTypes.DATEONLY, allowNull: false },
            end_date: { type: DataTypes.DATEONLY, allowNull: false },
            capacity: { type: DataTypes.INTEGER, allowNull: false },
            booked_slots: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: "Number of slots already booked for this batch",
            },
            available_slots: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: "Number of slots available for booking in this batch",
            },
            captain_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "trek_captains", key: "id" },
                comment: "Reference to assigned captain/guide for this specific batch",
            },
            status: {
                type: DataTypes.ENUM("active", "completed", "cancelled"),
                allowNull: false,
                defaultValue: "active",
            },
        },
        {
            tableName: "batches",
            underscored: true,
        }
    );

    Batch.associate = (models) => {
        Batch.belongsTo(models.Trek, { foreignKey: "trek_id", as: "trek" });

        Batch.belongsTo(models.TrekCaptain, {
            foreignKey: "captain_id",
            as: "captain"
        });

        Batch.hasMany(models.TrekStage, {
            foreignKey: "batch_id",
            as: "trek_stages",
        });

        Batch.hasMany(models.Accommodation, {
            foreignKey: "batch_id",
            as: "accommodations",
        });

        Batch.hasMany(models.Booking, {
            foreignKey: "batch_id",
            as: "bookings",
        });

        Batch.hasMany(models.CancellationBooking, {
            foreignKey: "batch_id",
            as: "cancellations",
        });

        Batch.hasMany(models.BatchCancellationRequest, {
            foreignKey: "batch_id",
            as: "cancellation_requests",
        });
    };

    return Batch;
};
