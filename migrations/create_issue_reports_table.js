'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const tables = await queryInterface.showAllTables();
        if (!tables.includes('issue_reports')) {
        await queryInterface.createTable('issue_reports', {
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
                comment: 'TIN/Trip ID from the form'
            },
            customer_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'customers',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
                comment: 'Customer who reported the issue'
            },
            name: {
                type: Sequelize.STRING(255),
                allowNull: false,
                comment: 'Name of the person reporting the issue'
            },
            phone_number: {
                type: Sequelize.STRING(20),
                allowNull: false,
                comment: 'Phone number of the reporter'
            },
            email: {
                type: Sequelize.STRING(255),
                allowNull: false,
                comment: 'Email ID of the reporter'
            },
            issue_type: {
                type: Sequelize.ENUM(
                    'accommodation_issue',
                    'trek_services_issue', 
                    'transportation_issue',
                    'other'
                ),
                allowNull: false,
                comment: 'Type of issue reported'
            },
            issue_category: {
                type: Sequelize.ENUM(
                    'drunken_driving',
                    'rash_unsafe_driving',
                    'sexual_harassment',
                    'verbal_abuse_assault',
                    'others'
                ),
                allowNull: true,
                comment: 'Specific category of the issue'
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Detailed description of the issue'
            },
            status: {
                type: Sequelize.ENUM(
                    'pending',
                    'in_progress',
                    'resolved',
                    'closed'
                ),
                defaultValue: 'pending',
                allowNull: false,
                comment: 'Status of the issue report'
            },
            priority: {
                type: Sequelize.ENUM(
                    'low',
                    'medium',
                    'high',
                    'urgent'
                ),
                defaultValue: 'medium',
                allowNull: false,
                comment: 'Priority level of the issue'
            },
            assigned_to: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
                comment: 'Admin user assigned to handle this issue'
            },
            resolution_notes: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Notes about how the issue was resolved'
            },
            resolved_at: {
                type: Sequelize.DATE,
                allowNull: true,
                comment: 'Timestamp when the issue was resolved'
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                comment: 'When the issue was reported'
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                comment: 'Last updated timestamp'
            }
        });

        // Add indexes for better performance
        try { await queryInterface.addIndex('issue_reports', ['booking_id']); } catch (_) {}
        try { await queryInterface.addIndex('issue_reports', ['customer_id']); } catch (_) {}
        try { await queryInterface.addIndex('issue_reports', ['status']); } catch (_) {}
        try { await queryInterface.addIndex('issue_reports', ['issue_type']); } catch (_) {}
        try { await queryInterface.addIndex('issue_reports', ['created_at']); } catch (_) {}
        try { await queryInterface.addIndex('issue_reports', ['assigned_to']); } catch (_) {}
        }
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('issue_reports');
    }
};
