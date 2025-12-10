module.exports = (sequelize, DataTypes) => {
    const CancellationPolicy = sequelize.define(
        "CancellationPolicy",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            title: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            rules: {
                type: DataTypes.JSON,
                allowNull: false,
                get() {
                    const rawValue = this.getDataValue("rules");
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
                validate: {
                    isValidRules(value) {
                        if (!Array.isArray(value)) {
                            throw new Error("Rules must be an array");
                        }

                        for (const rule of value) {
                            if (
                                !rule.rule ||
                                rule.deduction === undefined ||
                                !rule.deduction_type
                            ) {
                                throw new Error(
                                    "Each rule must have rule, deduction, and deduction_type"
                                );
                            }

                            if (
                                !["percentage", "fixed"].includes(
                                    rule.deduction_type
                                )
                            ) {
                                throw new Error(
                                    "deduction_type must be either 'percentage' or 'fixed'"
                                );
                            }

                            if (
                                rule.deduction_type === "percentage" &&
                                (rule.deduction < 0 || rule.deduction > 100)
                            ) {
                                throw new Error(
                                    "Percentage deduction must be between 0 and 100"
                                );
                            }

                            if (
                                rule.deduction_type === "fixed" &&
                                rule.deduction < 0
                            ) {
                                throw new Error(
                                    "Fixed deduction cannot be negative"
                                );
                            }
                        }
                    },
                },
            },
            descriptionPoints: {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: [],
                get() {
                    const rawValue = this.getDataValue("descriptionPoints");
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
                validate: {
                    isValidDescriptionPoints(value) {
                        if (value && !Array.isArray(value)) {
                            throw new Error(
                                "Description points must be an array"
                            );
                        }
                        if (value) {
                            for (const point of value) {
                                if (typeof point !== "string") {
                                    throw new Error(
                                        "Each description point must be a string"
                                    );
                                }
                            }
                        }
                    },
                },
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            sort_order: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
        },
        {
            tableName: "cancellation_policies",
            underscored: true,
        }
    );

    CancellationPolicy.associate = (models) => {
        // No direct association needed since treks use cancellation_policies JSON array
        // The relationship is handled through the JSON field containing policy IDs
    };

    return CancellationPolicy;
};
