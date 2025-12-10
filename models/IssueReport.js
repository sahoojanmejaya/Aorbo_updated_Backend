module.exports = (sequelize, DataTypes) => {
    const IssueReport = sequelize.define(
        "IssueReport",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            booking_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "bookings", key: "id" },
                comment: "TIN/Trip ID from the form",
            },
            customer_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "customers", key: "id" },
                comment: "Customer who reported the issue",
            },
            name: {
                type: DataTypes.STRING(255),
                allowNull: false,
                comment: "Name of the person reporting the issue",
            },
            phone_number: {
                type: DataTypes.STRING(20),
                allowNull: false,
                comment: "Phone number of the reporter",
            },
            email: {
                type: DataTypes.STRING(255),
                allowNull: false,
                comment: "Email ID of the reporter",
            },
            issue_type: {
                type: DataTypes.ENUM(
                    "accommodation_issue",
                    "trek_services_issue", 
                    "transportation_issue",
                    "other"
                ),
                allowNull: false,
                comment: "Type of issue reported",
            },
            issue_category: {
                type: DataTypes.ENUM(
                    "drunken_driving",
                    "rash_unsafe_driving",
                    "sexual_harassment",
                    "verbal_abuse_assault",
                    "others"
                ),
                allowNull: true,
                comment: "Specific category of the issue",
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Detailed description of the issue",
            },
            status: {
                type: DataTypes.ENUM(
                    "pending",
                    "open",
                    "in_progress",
                    "resolved",
                    "closed"
                ),
                defaultValue: "pending",
                comment: "Status of the issue report",
            },
            priority: {
                type: DataTypes.ENUM(
                    "low",
                    "medium",
                    "high",
                    "urgent"
                ),
                defaultValue: "medium",
                comment: "Priority level of the issue",
            },
            sla: {
                type: DataTypes.STRING(100),
                allowNull: true,
                comment: "SLA information or deadline for resolving the issue",
            },
            assigned_to: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "users", key: "id" },
                comment: "Admin user assigned to handle this issue",
            },
            disputed_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                comment: "Amount disputed by the customer - updated",
            },
            favoue_status: {
                type: DataTypes.ENUM(
                    "Adjustment",
                    "vendor Favour",
                    "Customer Favour",
                    "Processing",
                    "No Action"
                ),
                allowNull: true,
                comment: "Favour status based on disputed amount comparison",
            },
            favour_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                comment: "Favour amount from API disputed_amount",
            },
            resolution_notes: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Notes about how the issue was resolved",
            },
            resolved_at: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: "Timestamp when the issue was resolved",
            },
            created_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
                comment: "When the issue was reported",
            },
            updated_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
                comment: "Last updated timestamp",
            },
        },
        {
            tableName: "issue_reports",
            underscored: true,
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
        }
    );

    IssueReport.associate = (models) => {
        IssueReport.belongsTo(models.Booking, {
            foreignKey: "booking_id",
            as: "booking",
        });
        IssueReport.belongsTo(models.Customer, {
            foreignKey: "customer_id",
            as: "customer",
        });
        IssueReport.belongsTo(models.User, {
            foreignKey: "assigned_to",
            as: "assignedUser",
        });
    };

    return IssueReport;
};
