'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('cancellation_bookings', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            booking_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'bookings',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
                comment: 'Reference to the cancelled booking'
            },
            customer_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'customers',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
                comment: 'Reference to the customer who cancelled'
            },
            trek_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'treks',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
                comment: 'Reference to the trek that was cancelled'
            },
            batch_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'batches',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
                comment: 'Reference to the batch that was cancelled'
            },
            total_refundable_amount: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false,
                comment: 'Total amount that will be refunded to the customer'
            },
            status: {
                type: Sequelize.ENUM('pending', 'confirmed', 'processed', 'completed'),
                allowNull: false,
                defaultValue: 'confirmed',
                comment: 'Status of the cancellation request'
            },
            reason: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Optional reason for cancellation provided by customer'
            },
            cancellation_date: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW,
                comment: 'Date and time when cancellation was confirmed'
            },
            processed_date: {
                type: Sequelize.DATE,
                allowNull: true,
                comment: 'Date and time when refund was processed'
            },
            refund_transaction_id: {
                type: Sequelize.STRING,
                allowNull: true,
                comment: 'Transaction ID of the refund payment'
            },
            notes: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Internal notes for the cancellation'
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            }
        });

        // Add indexes for better performance
        await queryInterface.addIndex('cancellation_bookings', ['booking_id']);
        await queryInterface.addIndex('cancellation_bookings', ['customer_id']);
        await queryInterface.addIndex('cancellation_bookings', ['trek_id']);
        await queryInterface.addIndex('cancellation_bookings', ['status']);
        await queryInterface.addIndex('cancellation_bookings', ['cancellation_date']);
        
        // Add unique constraint to prevent duplicate cancellations for same booking
        await queryInterface.addIndex('cancellation_bookings', ['booking_id'], {
            unique: true,
            name: 'unique_booking_cancellation'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('cancellation_bookings');
    }
};
