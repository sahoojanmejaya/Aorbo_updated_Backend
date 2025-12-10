module.exports = (sequelize, DataTypes) => {
    const BatchCancellationRequest = sequelize.define(
        "BatchCancellationRequest",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            batch_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            vendor_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            reason: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            record_details: {
                type: DataTypes.JSON,
                allowNull: true,
            },
            status: {
                type: DataTypes.ENUM('pending', 'approved', 'rejected'),
                defaultValue: 'pending',
            },
            admin_response: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            processed_by: {
                type: DataTypes.INTEGER,
                allowNull: true,
                comment: "ID of admin who processed the request",
            },
            processed_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            requested_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
            },
        },
        {
            tableName: "batch_cancellation_requests",
            underscored: true,
            timestamps: true,
        }
    );

    // Associations completely removed to avoid model loading issues
    // Manual joins will be used in queries when needed
    // BatchCancellationRequest.associate = (models) => {
    //     // No associations
    // };

    return BatchCancellationRequest;
};