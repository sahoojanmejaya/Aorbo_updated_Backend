const { Rating, Customer, Trek, Booking } = require("../../models");
const { Op } = require("sequelize");

// Get all ratings with filters
const getAllRatings = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            trek_id,
            customer_id,
            status,
            is_approved,
            is_hide,
            report,
            search,
            sort_by = "created_at",
            sort_order = "DESC",
        } = req.query;

        const offset = (page - 1) * limit;
        const whereClause = {};

        if (trek_id) whereClause.trek_id = trek_id;
        if (customer_id) whereClause.customer_id = customer_id;
        if (status) whereClause.status = status;
        if (is_approved !== undefined) whereClause.is_approved = is_approved === "true";
        if (is_hide !== undefined) whereClause.is_hide = is_hide === "true";
        if (report !== undefined) whereClause.report = report === "true";

        if (search) {
            whereClause[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { content: { [Op.like]: `%${search}%` } },
                { comment: { [Op.like]: `%${search}%` } },
            ];
        }

        const { count, rows: ratings } = await Rating.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name", "email", "phone"],
                    required: false,
                },
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "slug"],
                    required: false,
                },
            ],
            order: [[sort_by, sort_order.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset),
        });

        res.json({
            success: true,
            data: {
                ratings,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: Math.ceil(count / limit),
                    total_items: count,
                    items_per_page: parseInt(limit),
                },
            },
        });
    } catch (error) {
        console.error("Error fetching ratings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch ratings",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
};

// Get rating statistics
const getRatingStats = async (req, res) => {
    try {
        const totalRatings = await Rating.count();
        const pendingApproval = await Rating.count({ where: { status: "pending" } });
        const approvedRatings = await Rating.count({ where: { status: "approved" } });
        const rejectedRatings = await Rating.count({ where: { status: "rejected" } });
        const spamRatings = await Rating.count({ where: { status: "spam" } });
        const reportedRatings = await Rating.count({ where: { report: true } });
        const hiddenRatings = await Rating.count({ where: { is_hide: true } });

        const avgRating = await Rating.findOne({
            attributes: [
                [Rating.sequelize.fn("AVG", Rating.sequelize.col("rating_value")), "average"],
            ],
            where: { status: "approved", is_hide: false },
        });

        res.json({
            success: true,
            data: {
                total_ratings: totalRatings,
                pending_approval: pendingApproval,
                approved: approvedRatings,
                rejected: rejectedRatings,
                spam: spamRatings,
                reported: reportedRatings,
                hidden: hiddenRatings,
                average_rating: avgRating
                    ? parseFloat(avgRating.dataValues.average || 0).toFixed(2)
                    : "0.00",
            },
        });
    } catch (error) {
        console.error("Error fetching rating stats:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch rating statistics",
        });
    }
};

// Get single rating
const getRatingById = async (req, res) => {
    try {
        const { id } = req.params;

        const rating = await Rating.findByPk(id, {
            include: [
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name", "email", "phone"],
                },
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title", "slug"],
                },
                {
                    model: Booking,
                    as: "booking",
                    attributes: ["id", "booking_reference", "status"],
                    required: false,
                },
            ],
        });

        if (!rating) {
            return res.status(404).json({
                success: false,
                message: "Rating not found",
            });
        }

        res.json({
            success: true,
            data: rating,
        });
    } catch (error) {
        console.error("Error fetching rating:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch rating",
        });
    }
};

// Approve rating
const approveRating = async (req, res) => {
    try {
        const { id } = req.params;

        const rating = await Rating.findByPk(id);

        if (!rating) {
            return res.status(404).json({
                success: false,
                message: "Rating not found",
            });
        }

        rating.is_approved = true;
        rating.is_hide = false;
        rating.status = "approved";
        await rating.save();

        res.json({
            success: true,
            message: "Rating approved successfully",
            data: rating,
        });
    } catch (error) {
        console.error("Error approving rating:", error);
        res.status(500).json({
            success: false,
            message: "Failed to approve rating",
        });
    }
};

// Reject rating
const rejectRating = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const rating = await Rating.findByPk(id);

        if (!rating) {
            return res.status(404).json({
                success: false,
                message: "Rating not found",
            });
        }

        rating.is_approved = false;
        rating.status = "rejected";
        await rating.save();

        res.json({
            success: true,
            message: "Rating rejected successfully",
            data: rating,
        });
    } catch (error) {
        console.error("Error rejecting rating:", error);
        res.status(500).json({
            success: false,
            message: "Failed to reject rating",
        });
    }
};

// Toggle visibility (hide/show)
const toggleRatingVisibility = async (req, res) => {
    try {
        const { id } = req.params;

        const rating = await Rating.findByPk(id);

        if (!rating) {
            return res.status(404).json({
                success: false,
                message: "Rating not found",
            });
        }

        rating.is_hide = !rating.is_hide;
        await rating.save();

        res.json({
            success: true,
            message: `Rating ${rating.is_hide ? "hidden" : "visible"} successfully`,
            data: { id: rating.id, is_hide: rating.is_hide },
        });
    } catch (error) {
        console.error("Error toggling rating visibility:", error);
        res.status(500).json({
            success: false,
            message: "Failed to toggle rating visibility",
        });
    }
};

// Mark rating as spam
const markRatingAsSpam = async (req, res) => {
    try {
        const { id } = req.params;

        const rating = await Rating.findByPk(id);

        if (!rating) {
            return res.status(404).json({
                success: false,
                message: "Rating not found",
            });
        }

        rating.status = "spam";
        rating.is_approved = false;
        rating.is_hide = true;
        await rating.save();

        res.json({
            success: true,
            message: "Rating marked as spam",
            data: { id: rating.id, status: rating.status },
        });
    } catch (error) {
        console.error("Error marking rating as spam:", error);
        res.status(500).json({
            success: false,
            message: "Failed to mark rating as spam",
        });
    }
};

// Delete rating (hard delete)
const deleteRating = async (req, res) => {
    try {
        const { id } = req.params;

        const rating = await Rating.findByPk(id);

        if (!rating) {
            return res.status(404).json({
                success: false,
                message: "Rating not found",
            });
        }

        await rating.destroy();

        res.json({
            success: true,
            message: "Rating deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting rating:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete rating",
        });
    }
};

module.exports = {
    getAllRatings,
    getRatingStats,
    getRatingById,
    approveRating,
    rejectRating,
    toggleRatingVisibility,
    markRatingAsSpam,
    deleteRating,
};
