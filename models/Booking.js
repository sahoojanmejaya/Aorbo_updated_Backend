module.exports = (sequelize, DataTypes) => {
    const Booking = sequelize.define(
        "Booking",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            customer_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "customers", key: "id" },
            },
            trek_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "treks", key: "id" },
            },
            vendor_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "vendors", key: "id" },
            },
            batch_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "batches", key: "id" },
            },

            coupon_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "coupons", key: "id" },
            },
            total_travelers: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1,
            },
            total_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
            },
            discount_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.0,
            },
            final_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
            },
            payment_status: {
                type: DataTypes.ENUM(
                    "pending",
                    "partial",
                    "completed",
                    "failed",
                    "refunded",
                    "advance_only",
                    "full_paid"
                ),
                defaultValue: "pending",
            },
            status: {
                type: DataTypes.ENUM(
                    "pending",
                    "confirmed",
                    "cancelled",
                    "completed"
                ),
                defaultValue: "pending",
            },
            booking_date: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
            },
            special_requests: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            booking_source: {
                type: DataTypes.ENUM("web", "mobile", "phone", "walk_in"),
                defaultValue: "web",
            },
            primary_contact_traveler_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "travelers", key: "id" },
            },
            city_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "cities", key: "id" },
                comment: "City ID for boarding point location",
            },
            cancellation_policy_type: {
                type: DataTypes.ENUM("flexible", "standard"),
                allowNull: true,
                comment: "Type of cancellation policy selected by customer",
            },
            advance_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                defaultValue: 0.0,
                comment: "Amount paid as advance payment",
            },
            remaining_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                defaultValue: 0.0,
                comment: "Remaining amount to be paid",
            },
            policy_version: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "Version/snapshot of policy at booking time",
            },
            deduction_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                comment: "Calculated deduction amount for cancellation",
            },
            refund_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                comment: "Calculated refund amount for cancellation",
            },
            cancellation_rule: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Rule applied for cancellation calculation",
            },
            cancelled_by: {
                type: DataTypes.ENUM("customer", "vendor", "admin", "not_declare"),
                allowNull: true,
                comment: "Indicates who initiated the cancellation",
            },
            // Indicates payment captured/verified at gateway but booking failed (e.g., no slots)
            // TODO: Uncomment after adding column to database manually
            payment_failed: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: "True when payment succeeded but booking confirmation failed",
            },
            payment_issue_reason: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: "Short reason for booking failure after payment (e.g., capacity_exhausted)",
            },
            // Fare breakup details
            total_basic_cost: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                comment: "Basic cost before any discounts or fees",
            },
            vendor_discount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                defaultValue: 0.0,
                comment: "Discount provided by vendor",
            },
            coupon_discount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                defaultValue: 0.0,
                comment: "Discount from coupon code",
            },
            platform_fees: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                defaultValue: 0.0,
                comment: "Platform service fees",
            },
            gst_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                defaultValue: 0.0,
                comment: "GST amount on booking",
            },
            insurance_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                defaultValue: 0.0,
                comment: "Insurance amount",
            },
            free_cancellation_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                defaultValue: 0.0,
                comment: "Free cancellation coverage amount",
            },
        },
        {
            tableName: "bookings",
            underscored: true,
        }
    );

    Booking.associate = (models) => {
        Booking.belongsTo(models.Customer, {
            foreignKey: "customer_id",
            as: "customer",
        });
        Booking.belongsTo(models.Trek, { foreignKey: "trek_id", as: "trek" });
        Booking.belongsTo(models.Vendor, {
            foreignKey: "vendor_id",
            as: "vendor",
        });
        Booking.belongsTo(models.Batch, {
            foreignKey: "batch_id",
            as: "batch",
        });

        Booking.belongsTo(models.City, {
            foreignKey: "city_id",
            as: "city",
        });

        Booking.belongsTo(models.Coupon, {
            foreignKey: "coupon_id",
            as: "coupon",
        });
        Booking.belongsTo(models.Traveler, {
            foreignKey: "primary_contact_traveler_id",
            as: "primaryContact",
        });
        Booking.hasMany(models.BookingTraveler, {
            foreignKey: "booking_id",
            as: "travelers",
        });
        // Removed BookingParticipant association - using only travelers now
        Booking.hasMany(models.PaymentLog, {
            foreignKey: "booking_id",
            as: "payments",
        });
        Booking.hasMany(models.Adjustment, {
            foreignKey: "booking_id",
            as: "adjustments",
        });
        Booking.hasOne(models.Cancellation, {
            foreignKey: "booking_id",
            as: "cancellation",
        });
        Booking.hasOne(models.CancellationBooking, {
            foreignKey: "booking_id",
            as: "cancellationBooking",
        });
       // Booking.belongsTo(models.Vendor, { foreignKey: "vendor_id", as: "vendor" });
    };


    return Booking;
};
