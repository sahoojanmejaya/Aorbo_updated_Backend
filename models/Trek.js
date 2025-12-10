module.exports = (sequelize, DataTypes) => {
    const Trek = sequelize.define(
        "Trek",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            mtr_id: {
                type: DataTypes.STRING(10),
                allowNull: false,
                unique: true,
                comment:
                    "Main Trek Record ID - auto-generated unique identifier",
                defaultValue: function () {
                    // Generate MTR ID: MTR + 2-digit timestamp + 5 random characters
                    const timestamp = Date.now().toString().slice(-2);
                    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                    let random = "";
                    for (let i = 0; i < 5; i++) {
                        random += chars.charAt(
                            Math.floor(Math.random() * chars.length)
                        );
                    }
                    return `MTR${timestamp}${random}`;
                },
            },
            title: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            vendor_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "vendors", key: "id" },
            },
            destination_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "destinations", key: "id" },
            },
            // state_id removed as per requirements
            captain_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "trek_captains", key: "id" },
                comment: "Reference to assigned captain/guide for the trek",
            },
            city_ids: {
                type: DataTypes.JSON,
                allowNull: true,
                get() {
                    const rawValue = this.getDataValue("city_ids");
                    if (!rawValue) return [];
                    if (Array.isArray(rawValue)) return rawValue;
                    if (typeof rawValue === "string") {
                        try {
                            const parsed = JSON.parse(rawValue);
                            return Array.isArray(parsed) ? parsed : [];
                        } catch (e) {
                            return [];
                        }
                    }
                    return [];
                },
                comment: "JSON array of city IDs",
            },
            duration: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            duration_days: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            duration_nights: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },

            // category removed as per requirements
            base_price: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
            },
            max_participants: {
                type: DataTypes.INTEGER,
                allowNull: true,
                defaultValue: 20,
                comment: "Maximum number of participants allowed for this trek",
            },
            // short_description removed as per requirements
            trekking_rules: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Trekking rules and guidelines",
            },
            emergency_protocols: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Emergency protocols and safety notes",
            },
            organizer_notes: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "Additional notes from the organizer",
            },
            inclusions: {
                type: DataTypes.JSON,
                allowNull: true,
                get() {
                    const rawValue = this.getDataValue("inclusions");
                    if (!rawValue) return [];
                    if (Array.isArray(rawValue)) return rawValue;
                    if (typeof rawValue === "string") {
                        try {
                            const parsed = JSON.parse(rawValue);
                            return Array.isArray(parsed) ? parsed : [];
                        } catch (e) {
                            return [];
                        }
                    }
                    return [];
                },
            },
            exclusions: {
                type: DataTypes.JSON,
                allowNull: true,
                get() {
                    const rawValue = this.getDataValue("exclusions");
                    if (!rawValue) return [];
                    if (Array.isArray(rawValue)) return rawValue;
                    if (typeof rawValue === "string") {
                        try {
                            const parsed = JSON.parse(rawValue);
                            return Array.isArray(parsed) ? parsed : [];
                        } catch (e) {
                            return [];
                        }
                    }
                    return [];
                },
            },
            status: {
                type: DataTypes.ENUM("active", "deactive"),
                defaultValue: "deactive",
            },
            discount_value: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                defaultValue: 0.0,
                comment: "Discount amount or percentage value",
            },
            discount_type: {
                type: DataTypes.ENUM("percentage", "fixed"),
                allowNull: true,
                defaultValue: "percentage",
                comment: "Type of discount: percentage or fixed amount",
            },
            has_discount: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: "Whether the trek has an active discount",
            },
            cancellation_policy_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "cancellation_policies", key: "id" },
                comment: "Reference to cancellation policy",
            },
            // other_policies removed as per requirements
            activities: {
                type: DataTypes.JSON,
                allowNull: true,
                get() {
                    const rawValue = this.getDataValue("activities");
                    if (!rawValue) return [];
                    if (Array.isArray(rawValue)) return rawValue;
                    if (typeof rawValue === "string") {
                        try {
                            const parsed = JSON.parse(rawValue);
                            return Array.isArray(parsed) ? parsed : [];
                        } catch (e) {
                            return [];
                        }
                    }
                    return [];
                },
                comment: "JSON array of activity IDs from activities table",
            },
            badge_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "badges", key: "id" },
                comment: "Optional badge associated with this trek",
            },
            has_been_edited: {
                type: DataTypes.TINYINT,
                allowNull: false,
                defaultValue: 0,
                comment: "Whether the trek has been edited (0 = no, 1 = yes)",
            },
            safety_security_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: "Count for Safety and Security category rating",
            },
            organizer_manner_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: "Count for Organizer Manner category rating",
            },
            trek_planning_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: "Count for Trek Planning category rating",
            },
            women_safety_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                comment: "Count for Women Safety category rating",
            },
        },
        {
            tableName: "treks",
            underscored: true,
            indexes: [
                // Removed unique constraint due to MySQL compatibility issues
                // Business rule: Only one active trek per vendor-destination combination
                // This should be enforced at the application level instead
            ],
        }
    );

    Trek.associate = (models) => {
        Trek.belongsTo(models.Vendor, {
            foreignKey: "vendor_id",
            as: "vendor",
        });
        Trek.belongsTo(models.Destination, {
            foreignKey: "destination_id",
            as: "destinationData",
        });
        // State association removed as state_id field was removed
        Trek.belongsTo(models.TrekCaptain, {
            foreignKey: "captain_id",
            as: "captain",
        });
        Trek.belongsTo(models.CancellationPolicy, {
            foreignKey: "cancellation_policy_id",
            as: "cancellation_policy",
        });
        Trek.hasMany(models.Category, {
            foreignKey: "trek_id",
            as: "categories",
        });
        Trek.hasMany(models.Batch, { foreignKey: "trek_id", as: "batches" });
        Trek.hasMany(models.SafetyGuideline, {
            foreignKey: "trek_id",
            as: "safety_guidelines",
        });
        Trek.hasMany(models.ItineraryItem, {
            foreignKey: "trek_id",
            as: "itinerary_items",
        });
        Trek.hasMany(models.Accommodation, {
            foreignKey: "trek_id",
            as: "accommodations",
        });
        Trek.hasMany(models.TrekImage, { foreignKey: "trek_id", as: "images" });
        Trek.hasMany(models.TrekStage, {
            foreignKey: "trek_id",
            as: "trek_stages",
        });
        Trek.hasMany(models.Booking, { foreignKey: "trek_id", as: "bookings" });

        // Location-related associations
        Trek.hasMany(models.Mapping, {
            foreignKey: "trek_id",
            as: "mappings",
        });
        Trek.hasMany(models.WeatherLog, {
            foreignKey: "trek_id",
            as: "weather_logs",
        });

        // Rating associations (now includes both ratings and reviews)
        Trek.hasMany(models.Rating, {
            foreignKey: "trek_id",
            as: "ratings",
        });
        Trek.belongsTo(models.Badge, {
            foreignKey: "badge_id",
            as: "badge",
        });
    };

    return Trek;
};
