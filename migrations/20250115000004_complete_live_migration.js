const { DataTypes } = require('sequelize');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            console.log('Starting complete live migration: All changes in one file...');
            
            // Step 1: Add new columns to ratings table from reviews table
            console.log('Step 1: Adding review fields to ratings table...');
            
            // Check if columns already exist
            const tableDescription = await queryInterface.describeTable('ratings', { transaction });
            
            if (!tableDescription.title) {
                await queryInterface.addColumn('ratings', 'title', {
                    type: DataTypes.STRING,
                    allowNull: true,
                    comment: 'Title of the review'
                }, { transaction });
            } else {
                console.log('title column already exists, skipping...');
            }

            if (!tableDescription.content) {
                await queryInterface.addColumn('ratings', 'content', {
                    type: DataTypes.TEXT,
                    allowNull: true,
                    comment: 'The review content/text'
                }, { transaction });
            } else {
                console.log('content column already exists, skipping...');
            }

            if (!tableDescription.is_approved) {
                await queryInterface.addColumn('ratings', 'is_approved', {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: true,
                    comment: 'Whether this review has been approved by admin'
                }, { transaction });
            } else {
                console.log('is_approved column already exists, skipping...');
            }

            if (!tableDescription.is_helpful) {
                await queryInterface.addColumn('ratings', 'is_helpful', {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    defaultValue: 0,
                    comment: 'Number of people who found this review helpful'
                }, { transaction });
            } else {
                console.log('is_helpful column already exists, skipping...');
            }

            if (!tableDescription.status) {
                await queryInterface.addColumn('ratings', 'status', {
                    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'spam'),
                    allowNull: false,
                    defaultValue: 'pending',
                    comment: 'Status of the review'
                }, { transaction });
            } else {
                console.log('status column already exists, skipping...');
            }

            // Step 2: Add category count columns to treks table
            console.log('Step 2: Adding category count columns to treks table...');
            
            // Get treks table description
            const treksTableDescription = await queryInterface.describeTable('treks', { transaction });
            
            if (!treksTableDescription.safety_security_count) {
                await queryInterface.addColumn('treks', 'safety_security_count', {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    defaultValue: 0,
                    comment: 'Count for Safety and Security category rating'
                }, { transaction });
            } else {
                console.log('safety_security_count column already exists in treks, skipping...');
            }

            if (!treksTableDescription.organizer_manner_count) {
                await queryInterface.addColumn('treks', 'organizer_manner_count', {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    defaultValue: 0,
                    comment: 'Count for Organizer Manner category rating'
                }, { transaction });
            } else {
                console.log('organizer_manner_count column already exists in treks, skipping...');
            }

            if (!treksTableDescription.trek_planning_count) {
                await queryInterface.addColumn('treks', 'trek_planning_count', {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    defaultValue: 0,
                    comment: 'Count for Trek Planning category rating'
                }, { transaction });
            } else {
                console.log('trek_planning_count column already exists in treks, skipping...');
            }

            if (!treksTableDescription.women_safety_count) {
                await queryInterface.addColumn('treks', 'women_safety_count', {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    defaultValue: 0,
                    comment: 'Count for Women Safety category rating'
                }, { transaction });
            } else {
                console.log('women_safety_count column already exists in treks, skipping...');
            }

            // Step 3: Migrate data from reviews to ratings (if reviews table exists)
            console.log('Step 3: Migrating data from reviews to ratings...');
            
            try {
                const reviews = await queryInterface.sequelize.query(
                    'SELECT * FROM reviews ORDER BY id',
                    { type: Sequelize.QueryTypes.SELECT, transaction }
                );

                console.log(`Found ${reviews.length} reviews to migrate`);

                for (const review of reviews) {
                    // Check if a rating already exists for this trek_id, customer_id, booking_id combination
                    const existingRating = await queryInterface.sequelize.query(
                        `SELECT id FROM ratings WHERE trek_id = :trek_id AND customer_id = :customer_id AND booking_id = :booking_id`,
                        {
                            replacements: {
                                trek_id: review.trek_id,
                                customer_id: review.customer_id,
                                booking_id: review.booking_id
                            },
                            type: Sequelize.QueryTypes.SELECT,
                            transaction
                        }
                    );

                    if (existingRating.length > 0) {
                        // Update existing rating with review data
                        await queryInterface.sequelize.query(
                            `UPDATE ratings SET 
                                title = :title,
                                content = :content,
                                is_approved = :is_approved,
                                is_helpful = :is_helpful,
                                status = :status,
                                is_verified = :is_verified
                            WHERE id = :rating_id`,
                            {
                                replacements: {
                                    title: review.title,
                                    content: review.content,
                                    is_approved: review.is_approved,
                                    is_helpful: review.is_helpful,
                                    status: review.status,
                                    is_verified: review.is_verified,
                                    rating_id: existingRating[0].id
                                },
                                transaction
                            }
                        );
                    } else {
                        // Create new rating entry with review data
                        await queryInterface.sequelize.query(
                            `INSERT INTO ratings (
                                trek_id, customer_id, booking_id, rating_value, comment,
                                is_verified, title, content, is_approved, is_helpful, status,
                                created_at, updated_at
                            ) VALUES (
                                :trek_id, :customer_id, :booking_id, 5.0, :content,
                                :is_verified, :title, :content, :is_approved, :is_helpful, :status,
                                :created_at, :updated_at
                            )`,
                            {
                                replacements: {
                                    trek_id: review.trek_id,
                                    customer_id: review.customer_id,
                                    booking_id: review.booking_id,
                                    content: review.content,
                                    is_verified: review.is_verified,
                                    title: review.title,
                                    is_approved: review.is_approved,
                                    is_helpful: review.is_helpful,
                                    status: review.status,
                                    created_at: review.created_at || new Date(),
                                    updated_at: review.updated_at || new Date()
                                },
                                transaction
                            }
                        );
                    }
                }
            } catch (error) {
                console.log('Reviews table does not exist or is empty, skipping data migration...');
            }

            // Step 4: Remove category_id column from ratings table
            console.log('Step 4: Removing category_id column from ratings table...');
            
            try {
                await queryInterface.removeConstraint('ratings', 'ratings_category_id_fkey', { transaction });
            } catch (error) {
                console.log('Foreign key constraint does not exist, continuing...');
            }
            
            try {
                await queryInterface.removeColumn('ratings', 'category_id', { transaction });
            } catch (error) {
                console.log('category_id column does not exist, continuing...');
            }

            // Step 5: Drop the reviews table (if it exists)
            console.log('Step 5: Dropping reviews table...');
            
            try {
                // Drop foreign key constraints first
                const constraints = ['reviews_trek_id_fkey', 'reviews_customer_id_fkey', 'reviews_booking_id_fkey'];
                for (const constraint of constraints) {
                    try {
                        await queryInterface.removeConstraint('reviews', constraint, { transaction });
                    } catch (error) {
                        console.log(`Constraint ${constraint} does not exist, continuing...`);
                    }
                }
                
                // Drop the table
                await queryInterface.dropTable('reviews', { transaction });
                console.log('Reviews table dropped successfully');
            } catch (error) {
                console.log('Reviews table does not exist, skipping drop...');
            }

            // Step 6: Add batch_id to accommodations (if needed)
            console.log('Step 6: Adding batch_id to accommodations...');
            
            try {
                const tableDescription = await queryInterface.describeTable('accommodations');
                
                if (!tableDescription.batch_id) {
                    await queryInterface.addColumn('accommodations', 'batch_id', {
                        type: DataTypes.INTEGER,
                        allowNull: true,
                        references: { 
                            model: 'batches', 
                            key: 'id' 
                        },
                        onDelete: 'CASCADE',
                        comment: 'Reference to specific batch - makes accommodations batch-specific'
                    }, { transaction });
                    console.log('batch_id column added to accommodations');
                } else {
                    console.log('batch_id column already exists in accommodations, skipping...');
                }

                // Add indexes
                const indexes = await queryInterface.showIndex('accommodations', { transaction });
                const indexNames = indexes.map(idx => idx.name);

                if (!indexNames.includes('accommodations_batch_id_idx')) {
                    await queryInterface.addIndex('accommodations', ['batch_id'], {
                        name: 'accommodations_batch_id_idx'
                    }, { transaction });
                }

                if (!indexNames.includes('accommodations_trek_batch_idx')) {
                    await queryInterface.addIndex('accommodations', ['trek_id', 'batch_id'], {
                        name: 'accommodations_trek_batch_idx'
                    }, { transaction });
                }
            } catch (error) {
                console.log('Error adding batch_id to accommodations:', error.message);
            }

            await transaction.commit();
            console.log('Complete live migration completed successfully!');
            
        } catch (error) {
            await transaction.rollback();
            console.error('Complete live migration failed:', error);
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            console.log('Rolling back complete live migration...');
            
            // Remove all added columns from ratings table
            const ratingsColumnsToRemove = [
                'status', 'is_helpful', 'is_approved', 'content', 'title'
            ];
            
            for (const column of ratingsColumnsToRemove) {
                try {
                    await queryInterface.removeColumn('ratings', column, { transaction });
                } catch (error) {
                    console.log(`Column ${column} does not exist in ratings, skipping...`);
                }
            }

            // Remove count columns from treks table
            const treksColumnsToRemove = [
                'women_safety_count', 'trek_planning_count', 'organizer_manner_count', 'safety_security_count'
            ];
            
            for (const column of treksColumnsToRemove) {
                try {
                    await queryInterface.removeColumn('treks', column, { transaction });
                } catch (error) {
                    console.log(`Column ${column} does not exist in treks, skipping...`);
                }
            }

            // Add category_id back to ratings
            try {
                await queryInterface.addColumn('ratings', 'category_id', {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: 'rating_categories', key: 'id' },
                    comment: 'Reference to the rating category'
                }, { transaction });
            } catch (error) {
                console.log('Error adding category_id back:', error.message);
            }

            // Recreate reviews table (if needed)
            try {
                await queryInterface.createTable('reviews', {
                    id: {
                        type: DataTypes.INTEGER,
                        primaryKey: true,
                        autoIncrement: true
                    },
                    trek_id: {
                        type: DataTypes.INTEGER,
                        allowNull: false,
                        references: { model: 'treks', key: 'id' }
                    },
                    customer_id: {
                        type: DataTypes.INTEGER,
                        allowNull: false,
                        references: { model: 'customers', key: 'id' }
                    },
                    booking_id: {
                        type: DataTypes.INTEGER,
                        allowNull: true,
                        references: { model: 'bookings', key: 'id' }
                    },
                    title: {
                        type: DataTypes.STRING,
                        allowNull: true
                    },
                    content: {
                        type: DataTypes.TEXT,
                        allowNull: true
                    },
                    is_approved: {
                        type: DataTypes.BOOLEAN,
                        allowNull: false,
                        defaultValue: false
                    },
                    is_helpful: {
                        type: DataTypes.INTEGER,
                        allowNull: false,
                        defaultValue: 0
                    },
                    status: {
                        type: DataTypes.ENUM('pending', 'approved', 'rejected', 'spam'),
                        allowNull: false,
                        defaultValue: 'pending'
                    },
                    is_verified: {
                        type: DataTypes.BOOLEAN,
                        allowNull: false,
                        defaultValue: false
                    },
                    created_at: {
                        type: DataTypes.DATE,
                        allowNull: false
                    },
                    updated_at: {
                        type: DataTypes.DATE,
                        allowNull: false
                    }
                }, { transaction });
                console.log('Reviews table recreated successfully');
            } catch (error) {
                console.log('Error recreating reviews table:', error.message);
            }

            // Remove batch_id from accommodations
            try {
                await queryInterface.removeIndex('accommodations', 'accommodations_trek_batch_idx', { transaction });
                await queryInterface.removeIndex('accommodations', 'accommodations_batch_id_idx', { transaction });
                await queryInterface.removeColumn('accommodations', 'batch_id', { transaction });
            } catch (error) {
                console.log('Error removing batch_id from accommodations:', error.message);
            }

            await transaction.commit();
            console.log('Rollback completed successfully!');
            
        } catch (error) {
            await transaction.rollback();
            console.error('Rollback failed:', error);
            throw error;
        }
    }
};
