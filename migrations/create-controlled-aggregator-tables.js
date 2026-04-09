'use strict';

/**
 * Migration script for Controlled Aggregator Backend
 * Creates pending_bookings, commission_settings, settlements, tax_settings,
 * coupon_usages tables and adds columns to treks, bookings, customers, users.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // alias so legacy code below works unchanged
    const sequelize = { Sequelize, getQueryInterface: () => queryInterface };

    try {
        console.log("Starting migration...");
        
        // 1. Create pending_bookings table
        console.log("Creating pending_bookings table...");
        await queryInterface.createTable("pending_bookings", {
            id: {
                type: sequelize.Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            order_id: {
                type: sequelize.Sequelize.STRING,
                allowNull: false,
                unique: true
            },
            customer_id: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: false,
                references: { model: "customers", key: "id" }
            },
            batch_id: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: false,
                references: { model: "batches", key: "id" }
            },
            trek_id: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: false,
                references: { model: "treks", key: "id" }
            },
            vendor_id: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: false,
                references: { model: "vendors", key: "id" }
            },
            traveler_count: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: false
            },
            travelers: {
                type: sequelize.Sequelize.JSON,
                allowNull: false
            },
            fare_data: {
                type: sequelize.Sequelize.JSON,
                allowNull: false
            },
            amount: {
                type: sequelize.Sequelize.DECIMAL(10, 2),
                allowNull: false
            },
            status: {
                type: sequelize.Sequelize.ENUM("pending", "completed", "expired", "failed"),
                defaultValue: "pending"
            },
            booking_id: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: true
            },
            expires_at: {
                type: sequelize.Sequelize.DATE,
                allowNull: false
            },
            created_at: {
                type: sequelize.Sequelize.DATE,
                allowNull: false
            },
            updated_at: {
                type: sequelize.Sequelize.DATE,
                allowNull: false
            }
        });
        
        // 2. Create commission_settings table
        console.log("Creating commission_settings table...");
        await queryInterface.createTable("commission_settings", {
            id: {
                type: sequelize.Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            vendor_id: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: false,
                references: { model: "vendors", key: "id" }
            },
            commission_type: {
                type: sequelize.Sequelize.ENUM("percentage", "fixed"),
                defaultValue: "percentage"
            },
            commission_value: {
                type: sequelize.Sequelize.DECIMAL(10, 2),
                allowNull: false
            },
            effective_from: {
                type: sequelize.Sequelize.DATE,
                allowNull: false
            },
            effective_until: {
                type: sequelize.Sequelize.DATE,
                allowNull: true
            },
            status: {
                type: sequelize.Sequelize.ENUM("active", "inactive"),
                defaultValue: "active"
            },
            created_by_admin_id: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: false,
                references: { model: "users", key: "id" }
            },
            notes: {
                type: sequelize.Sequelize.TEXT,
                allowNull: true
            },
            created_at: {
                type: sequelize.Sequelize.DATE,
                allowNull: false
            },
            updated_at: {
                type: sequelize.Sequelize.DATE,
                allowNull: false
            }
        });
        
        // 3. Create settlements table
        console.log("Creating settlements table...");
        await queryInterface.createTable("settlements", {
            id: {
                type: sequelize.Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            vendor_id: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: false,
                references: { model: "vendors", key: "id" }
            },
            booking_ids: {
                type: sequelize.Sequelize.JSON,
                allowNull: false
            },
            total_amount: {
                type: sequelize.Sequelize.DECIMAL(10, 2),
                allowNull: false
            },
            commission_amount: {
                type: sequelize.Sequelize.DECIMAL(10, 2),
                allowNull: false
            },
            payout_amount: {
                type: sequelize.Sequelize.DECIMAL(10, 2),
                allowNull: false
            },
            settlement_date: {
                type: sequelize.Sequelize.DATE,
                allowNull: false
            },
            status: {
                type: sequelize.Sequelize.ENUM("pending", "processing", "processed", "failed"),
                defaultValue: "pending"
            },
            payout_method: {
                type: sequelize.Sequelize.STRING,
                allowNull: true
            },
            payout_reference: {
                type: sequelize.Sequelize.STRING,
                allowNull: true
            },
            processed_by: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: true,
                references: { model: "users", key: "id" }
            },
            processed_at: {
                type: sequelize.Sequelize.DATE,
                allowNull: true
            },
            notes: {
                type: sequelize.Sequelize.TEXT,
                allowNull: true
            },
            created_at: {
                type: sequelize.Sequelize.DATE,
                allowNull: false
            },
            updated_at: {
                type: sequelize.Sequelize.DATE,
                allowNull: false
            }
        });
        
        // 4. Create tax_settings table
        console.log("Creating tax_settings table...");
        await queryInterface.createTable("tax_settings", {
            id: {
                type: sequelize.Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            tax_name: {
                type: sequelize.Sequelize.STRING,
                allowNull: false
            },
            tax_type: {
                type: sequelize.Sequelize.ENUM("percentage", "fixed"),
                defaultValue: "percentage"
            },
            tax_value: {
                type: sequelize.Sequelize.DECIMAL(10, 2),
                allowNull: false
            },
            vendor_id: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: true,
                references: { model: "vendors", key: "id" }
            },
            status: {
                type: sequelize.Sequelize.ENUM("active", "inactive"),
                defaultValue: "active"
            },
            effective_from: {
                type: sequelize.Sequelize.DATE,
                allowNull: false
            },
            effective_until: {
                type: sequelize.Sequelize.DATE,
                allowNull: true
            },
            created_at: {
                type: sequelize.Sequelize.DATE,
                allowNull: false
            },
            updated_at: {
                type: sequelize.Sequelize.DATE,
                allowNull: false
            }
        });
        
        // 5. Create coupon_usages table
        console.log("Creating coupon_usages table...");
        await queryInterface.createTable("coupon_usages", {
            id: {
                type: sequelize.Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            coupon_id: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: false,
                references: { model: "coupons", key: "id" }
            },
            customer_id: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: false,
                references: { model: "customers", key: "id" }
            },
            booking_id: {
                type: sequelize.Sequelize.INTEGER,
                allowNull: true,
                references: { model: "bookings", key: "id" }
            },
            discount_amount: {
                type: sequelize.Sequelize.DECIMAL(10, 2),
                allowNull: false
            },
            used_at: {
                type: sequelize.Sequelize.DATE,
                defaultValue: sequelize.Sequelize.NOW
            },
            created_at: {
                type: sequelize.Sequelize.DATE,
                allowNull: false
            },
            updated_at: {
                type: sequelize.Sequelize.DATE,
                allowNull: false
            }
        });
        
        // 6. Update treks table
        console.log("Updating treks table...");
        try {
            await queryInterface.addColumn("treks", "approval_status", {
                type: sequelize.Sequelize.ENUM("pending", "approved", "rejected"),
                defaultValue: "pending"
            });
        } catch (e) {
            console.log("Column approval_status already exists");
        }
        
        try {
            await queryInterface.addColumn("treks", "admin_notes", {
                type: sequelize.Sequelize.TEXT,
                allowNull: true
            });
        } catch (e) {
            console.log("Column admin_notes already exists");
        }
        
        try {
            await queryInterface.addColumn("treks", "reviewed_by", {
                type: sequelize.Sequelize.INTEGER,
                allowNull: true
            });
        } catch (e) {
            console.log("Column reviewed_by already exists");
        }
        
        try {
            await queryInterface.addColumn("treks", "reviewed_at", {
                type: sequelize.Sequelize.DATE,
                allowNull: true
            });
        } catch (e) {
            console.log("Column reviewed_at already exists");
        }
        
        try {
            await queryInterface.addColumn("treks", "platform_fee_percentage", {
                type: sequelize.Sequelize.DECIMAL(5, 2),
                defaultValue: 10.00
            });
        } catch (e) {
            console.log("Column platform_fee_percentage already exists");
        }
        
        try {
            await queryInterface.addColumn("treks", "visibility", {
                type: sequelize.Sequelize.BOOLEAN,
                defaultValue: false
            });
        } catch (e) {
            console.log("Column visibility already exists");
        }
        
        try {
            await queryInterface.addColumn("treks", "featured", {
                type: sequelize.Sequelize.BOOLEAN,
                defaultValue: false
            });
        } catch (e) {
            console.log("Column featured already exists");
        }
        
        // 7. Update bookings table
        console.log("Updating bookings table...");
        try {
            await queryInterface.addColumn("bookings", "settlement_status", {
                type: sequelize.Sequelize.ENUM("pending", "settled", "cancelled"),
                defaultValue: "pending"
            });
        } catch (e) {
            console.log("Column settlement_status already exists");
        }
        
        try {
            await queryInterface.addColumn("bookings", "settled_at", {
                type: sequelize.Sequelize.DATE,
                allowNull: true
            });
        } catch (e) {
            console.log("Column settled_at already exists");
        }
        
        try {
            await queryInterface.addColumn("bookings", "razorpay_order_id", {
                type: sequelize.Sequelize.STRING,
                allowNull: true
            });
        } catch (e) {
            console.log("Column razorpay_order_id already exists");
        }
        
        try {
            await queryInterface.addColumn("bookings", "razorpay_payment_id", {
                type: sequelize.Sequelize.STRING,
                allowNull: true
            });
        } catch (e) {
            console.log("Column razorpay_payment_id already exists");
        }
        
        try {
            await queryInterface.addColumn("bookings", "tax_amount", {
                type: sequelize.Sequelize.DECIMAL(10, 2),
                defaultValue: 0
            });
        } catch (e) {
            console.log("Column tax_amount already exists");
        }
        
        try {
            await queryInterface.addColumn("bookings", "tax_breakdown", {
                type: sequelize.Sequelize.JSON,
                allowNull: true
            });
        } catch (e) {
            console.log("Column tax_breakdown already exists");
        }
        
        // 8. Update customers table
        console.log("Updating customers table...");
        try {
            await queryInterface.addColumn("customers", "fcm_token", {
                type: sequelize.Sequelize.STRING(500),
                allowNull: true
            });
        } catch (e) {
            console.log("Column fcm_token already exists in customers");
        }
        
        // 9. Update users table
        console.log("Updating users table...");
        try {
            await queryInterface.addColumn("users", "fcm_token", {
                type: sequelize.Sequelize.STRING(500),
                allowNull: true
            });
        } catch (e) {
            console.log("Column fcm_token already exists in users");
        }
        
        console.log("Migration completed successfully!");

    } catch (error) {
        console.error("Migration failed:", error);
        throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Drop tables created by this migration (reverse order)
    const dropIfExists = async (table) => {
      try { await queryInterface.dropTable(table); } catch (_) {}
    };
    await dropIfExists('coupon_usages');
    await dropIfExists('tax_settings');
    await dropIfExists('settlements');
    await dropIfExists('commission_settings');
    await dropIfExists('pending_bookings');
  },
};
