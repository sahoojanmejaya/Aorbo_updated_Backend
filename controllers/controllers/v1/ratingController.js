const { Rating, Trek, Customer, Booking } = require("../../models");
const { Op } = require("sequelize");
const logger = require("../../utils/logger");

// Helper function to update aggregated category counts for a trek
const updateTrekCategoryCounts = async (trekId, categoryCounts = {}) => {
    try {
        // If categoryCounts are provided (from new rating), use them
        if (Object.keys(categoryCounts).length > 0) {
            // Get current counts from trek
            const trek = await Trek.findByPk(trekId);
            if (!trek) return;

            // Add the new counts to existing ones
            const updatedCounts = {
                safety_security_count: (trek.safety_security_count || 0) + (categoryCounts.safety_security_count || 0),
                organizer_manner_count: (trek.organizer_manner_count || 0) + (categoryCounts.organizer_manner_count || 0),
                trek_planning_count: (trek.trek_planning_count || 0) + (categoryCounts.trek_planning_count || 0),
                women_safety_count: (trek.women_safety_count || 0) + (categoryCounts.women_safety_count || 0)
            };

            // Update the trek with the new counts
            await Trek.update(updatedCounts, { where: { id: trekId } });

            logger.info("rating", `Updated category counts for trek ${trekId}`);
        } else {
            // Recalculate from scratch (for updates/deletes)
            const ratings = await Rating.findAll({
                where: { trek_id: trekId }
            });

            // For now, just count total ratings per trek
            // In the future, you might want to store category preferences differently
            const totalRatings = ratings.length;

            // Update the trek with total rating count (you can modify this logic as needed)
            await Trek.update(
                {
                    safety_security_count: totalRatings, // Placeholder - adjust as needed
                    organizer_manner_count: totalRatings, // Placeholder - adjust as needed
                    trek_planning_count: totalRatings, // Placeholder - adjust as needed
                    women_safety_count: totalRatings // Placeholder - adjust as needed
                },
                {
                    where: { id: trekId }
                }
            );

            logger.info("rating", `Recalculated category counts for trek ${trekId}: total=${totalRatings}`);
        }
    } catch (error) {
        logger.error("rating", "Error updating trek category counts", { error: error.message });
    }
};

// Mobile: Submit rating and review (Authentication required)
exports.submitRating = async (req, res) => {
    try {
        // Identity from JWT — never from req.body
        const customer_id = req.customer.id;

        const {
            trek_id,
            booking_id,
            rating_value,
            content,
            safety_security_count,
            organizer_manner_count,
            trek_planning_count,
            women_safety_count,
            // is_verified, is_approved, is_helpful, status intentionally NOT accepted from body
        } = req.body;

        // Validation
        if (!trek_id || !rating_value) {
            return res.status(400).json({
                success: false,
                message: "trek_id and rating_value are required"
            });
        }

        if (rating_value < 1 || rating_value > 5) {
            return res.status(400).json({
                success: false,
                message: "rating_value must be between 1 and 5"
            });
        }

        // Check if trek exists
        const trek = await Trek.findByPk(trek_id);
        if (!trek) {
            return res.status(404).json({
                success: false,
                message: "Trek not found"
            });
        }

        // Check if customer exists
        const customer = await Customer.findByPk(customer_id);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        // Check if this booking already has a rating
        if (booking_id) {
            const existingRating = await Rating.findOne({
                where: {
                    booking_id: booking_id
                }
            });

            if (existingRating) {
                return res.status(400).json({
                    success: false,
                    message: "You have already reviewed this trek"
                });
            }
        }

        // Validate booking_id if provided
        if (booking_id) {
            const booking = await Booking.findOne({
                where: {
                    id: booking_id,
                    customer_id: customer_id,
                    trek_id: trek_id
                },
                attributes: ['id', 'customer_id', 'trek_id', 'status']
            });

            if (!booking) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid booking_id for this customer and trek"
                });
            }
        }

        // Create rating — status/is_approved/is_verified are server-controlled only
        const rating = await Rating.create({
            trek_id,
            customer_id,
            booking_id: booking_id || null,
            rating_value: parseFloat(rating_value),
            content: content || null,
            is_verified: false,    // server-set: not user-settable
            is_approved: false,    // server-set: requires admin approval
            is_helpful: 0,
            status: "pending",     // server-set
            safety_security_rated: !!(safety_security_count && safety_security_count > 0),
            organizer_manner_rated: !!(organizer_manner_count && organizer_manner_count > 0),
            trek_planning_rated: !!(trek_planning_count && trek_planning_count > 0),
            women_safety_rated: !!(women_safety_count && women_safety_count > 0),
        });

        // Update aggregated counts for this trek
        await updateTrekCategoryCounts(trek_id, {
            safety_security_count: safety_security_count || 0,
            organizer_manner_count: organizer_manner_count || 0,
            trek_planning_count: trek_planning_count || 0,
            women_safety_count: women_safety_count || 0
        });

        res.status(201).json({
            success: true,
            message: "Rating submitted successfully",
            data: rating
        });

    } catch (error) {
        logger.error("rating", "Error submitting rating", { error: error.message });
        res.status(500).json({ success: false, message: "Failed to submit rating" });
    }
};

// Mobile: Get customer's ratings (Authentication required)
exports.getCustomerRatings = async (req, res) => {
    try {
        // Use JWT identity — never the URL param — to prevent IDOR
        const customer_id = req.customer.id;

        const ratings = await Rating.findAll({
            where: { customer_id },
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "mtr_id"]
                }
            ],
            order: [["created_at", "DESC"]]
        });

        res.json({
            success: true,
            data: ratings
        });

    } catch (error) {
        logger.error("rating", "Error fetching customer ratings", { error: error.message });
        res.status(500).json({
            success: false,
            message: "Failed to fetch ratings"
        });
    }
};

// Mobile: Update rating (Authentication required)
exports.updateRating = async (req, res) => {
    try {
        const { id } = req.params;
        // Identity from JWT — never from body/params
        const customer_id = req.customer.id;

        const rating = await Rating.findOne({
            where: { id, customer_id }
        });

        if (!rating) {
            return res.status(404).json({
                success: false,
                message: "Rating not found or you don't have permission to update it"
            });
        }

        // Explicit field allowlist — is_approved, is_verified, status are NOT user-settable
        const { rating_value, content, safety_security_count, organizer_manner_count, trek_planning_count, women_safety_count } = req.body;
        const updatePayload = {};
        if (rating_value !== undefined) updatePayload.rating_value = parseFloat(rating_value);
        if (content !== undefined) updatePayload.content = content;
        if (safety_security_count !== undefined) updatePayload.safety_security_rated = safety_security_count > 0;
        if (organizer_manner_count !== undefined) updatePayload.organizer_manner_rated = organizer_manner_count > 0;
        if (trek_planning_count !== undefined) updatePayload.trek_planning_rated = trek_planning_count > 0;
        if (women_safety_count !== undefined) updatePayload.women_safety_rated = women_safety_count > 0;

        await rating.update(updatePayload);

        // Update aggregated counts for this trek
        await updateTrekCategoryCounts(rating.trek_id);

        res.json({
            success: true,
            message: "Rating updated successfully",
            data: rating
        });

    } catch (error) {
        logger.error("rating", "Error updating rating", { error: error.message });
        res.status(500).json({
            success: false,
            message: "Failed to update rating"
        });
    }
};

// Mobile: Delete rating (Authentication required)
exports.deleteRating = async (req, res) => {
    try {
        const { id } = req.params;
        const { customer_id } = req.body;

        // Find rating
        const rating = await Rating.findOne({
            where: {
                id: id,
                customer_id: customer_id
            }
        });

        if (!rating) {
            return res.status(404).json({
                success: false,
                message: "Rating not found or you don't have permission to delete it"
            });
        }

        // Store trek_id before deletion
        const trekId = rating.trek_id;

        // Delete rating
        await rating.destroy();

        // Update aggregated counts for this trek after deletion
        await updateTrekCategoryCounts(trekId);

        res.json({
            success: true,
            message: "Rating deleted successfully"
        });

    } catch (error) {
        logger.error("rating", "Error deleting rating", { error: error.message });
        res.status(500).json({
            success: false,
            message: "Failed to delete rating"
        });
    }
};

// Mobile: Get all ratings with customer details (No authentication required - public endpoint)
exports.getAllRatings = async (req, res) => {
    try {
        const { page = 1, limit = 10, trek_id } = req.query;
        const offset = (page - 1) * limit;

        // Build where clause
        const whereClause = {};
        if (trek_id) {
            whereClause.trek_id = trek_id;
        }

        const { count, rows: ratings } = await Rating.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name", "email", "phone"]
                }
            ],
            attributes: [
                "id",
                "trek_id", 
                "customer_id",
                "booking_id",
                "rating_value",
                "content",
                "created_at",
                "updated_at"
            ],
            order: [["created_at", "DESC"]],
            limit: parseInt(limit),
            offset: parseInt(offset),
        });

        // Format the response
        const formattedRatings = ratings.map(rating => {
            const ratingData = rating.toJSON();
            return {
                rating_id: ratingData.id,
                customer_id: ratingData.customer_id,
                customer_name: ratingData.customer ? ratingData.customer.name : null,
                customer_phone: ratingData.customer ? ratingData.customer.phone : null,
                customer_comment: ratingData.content,
                rating_value: parseFloat(ratingData.rating_value),
                booking_id: ratingData.booking_id,
                trek_id: ratingData.trek_id,
                created_at: ratingData.created_at
            };
        });

        res.json({
            success: true,
            data: formattedRatings,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / limit),
                totalCount: count,
            },
        });

    } catch (error) {
        logger.error("rating", "Error fetching ratings", { error: error.message });
        res.status(500).json({
            success: false,
            message: "Failed to fetch ratings"
        });
    }
};

// Mobile: Get all ratings without pagination (for review and feedback page)
exports.getAllRatingsUnlimited = async (req, res) => {
    try {
        const { trek_id } = req.query;

        // Build where clause
        const whereClause = {};
        if (trek_id) {
            whereClause.trek_id = trek_id;
        }

        const ratings = await Rating.findAll({
            where: whereClause,
            include: [
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name", "email", "phone"],
                    required: false // Make it optional to prevent filtering
                },
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "mtr_id"],
                    required: false // Make it optional to prevent filtering
                }
            ],
            attributes: [
                "id",
                "trek_id", 
                "customer_id",
                "booking_id",
                "batch_id",
                "rating_value",
                "content",
                "safety_security_rated",
                "organizer_manner_rated",
                "trek_planning_rated",
                "women_safety_rated",
                "is_verified",
                "is_approved",
                "is_helpful",
                "status",
                "created_at",
                "updated_at"
            ],
            order: [["created_at", "DESC"]],
        });

        // Format the response
        const formattedRatings = ratings.map(rating => {
            const ratingData = rating.toJSON();
            return {
                rating_id: ratingData.id,
                customer_id: ratingData.customer_id,
                customer_name: ratingData.customer ? ratingData.customer.name : null,
                customer_email: ratingData.customer ? ratingData.customer.email : null,
                customer_phone: ratingData.customer ? ratingData.customer.phone : null,
                customer_comment: ratingData.content,
                rating_value: parseFloat(ratingData.rating_value),
                booking_id: ratingData.booking_id,
                batch_id: ratingData.batch_id,
                trek_id: ratingData.trek_id,
                trek_title: ratingData.trek ? ratingData.trek.title : null,
                trek_mtr_id: ratingData.trek ? ratingData.trek.mtr_id : null,
                safety_security_rated: ratingData.safety_security_rated,
                organizer_manner_rated: ratingData.organizer_manner_rated,
                trek_planning_rated: ratingData.trek_planning_rated,
                women_safety_rated: ratingData.women_safety_rated,
                is_verified: ratingData.is_verified,
                is_approved: ratingData.is_approved,
                is_helpful: ratingData.is_helpful,
                status: ratingData.status,
                created_at: ratingData.created_at,
                updated_at: ratingData.updated_at
            };
        });

        res.json({
            success: true,
            data: formattedRatings,
            totalCount: formattedRatings.length
        });

    } catch (error) {
        logger.error("rating", "Error fetching all ratings", { error: error.message });
        res.status(500).json({
            success: false,
            message: "Failed to fetch all ratings"
        });
    }
};
