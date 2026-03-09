const {
    Rating,
    RatingCategory,
    Trek,
    Vendor,
    User,
    Customer,
    Booking,
    Batch,
    sequelize,
} = require("../../models");
const { Sequelize } = require("sequelize");
const { Op } = require("sequelize");
const logger = require("../../utils/logger");

const formatOneDecimal = (value) => Number(parseFloat(value || 0).toFixed(1));

/* =========================================================
   1. ADMIN DASHBOARD ANALYTICS
========================================================= */
exports.getAdminReviewDashboard = async (req, res) => {
   try {

        logger.info("admin-review", "=== ADMIN REVIEW DASHBOARD API CALLED ===");

        /* ===============================
           1. TOTAL REVIEWS
        =============================== */
        const totalReviews = await Rating.count();

        /* ===============================
           2. AVERAGE RATING
        =============================== */
        const avgRatingResult = await Rating.findOne({
            attributes: [[sequelize.fn("AVG", sequelize.col("rating_value")), "avgRating"]],
            raw: true,
        });
        const averageRating = formatOneDecimal(avgRatingResult?.avgRating);

        /* ===============================
           3. AVG CREDIBILITY (4 params)
        =============================== */
        const avgCredibilityResult = await Rating.findOne({
            attributes: [
                [sequelize.fn("AVG", sequelize.col("rating_value")), "safety"],
                [sequelize.fn("AVG", sequelize.col("rating_value")), "organizer"],
                [sequelize.fn("AVG", sequelize.col("rating_value")), "planning"],
                [sequelize.fn("AVG", sequelize.col("rating_value")), "womenSafety"],
            ],
            raw: true,
        });

        const avgCredibility = {
            safetySecurity: formatOneDecimal(avgCredibilityResult?.safety),
            organizerManner: formatOneDecimal(avgCredibilityResult?.organizer),
            trekPlanning: formatOneDecimal(avgCredibilityResult?.planning),
            womenSafety: formatOneDecimal(avgCredibilityResult?.womenSafety),
        };

        /* ===============================
           4. ACTIVE ISSUES
        =============================== */
        const activeIssuesCount = await Rating.count({
            where: { report: true },
        });

      /* ===============================
   5. CRITICAL QUEUE COUNT
=============================== */
const criticalQueueCount = await Rating.count({
    where: {
        [Op.or]: [
            { report: true },
            { rating_value: { [Op.lte]: 2 } }
        ],
    },
});

/* ===============================
   6. CRITICAL MODERATION QUEUE (CARDS)
=============================== */
const criticalQueue = await Rating.findAll({
    where: {
        [Op.or]: [
            { report: true },
            { rating_value: { [Op.lte]: 2 } }
        ],
    },
    include: [
        /* ========= CUSTOMER (DIRECT TABLE) ========= */
        {
            model: Customer,
            as: "customer",
            attributes: ["id", "name", "email", "phone"] // jo bhi fields hain
        },

        /* ========= BATCH → TREK → VENDOR → USER ========= */
        {
            model: Batch,
            as: "batch",
            attributes: ["id", "tbr_id"],
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title"],
                    include: [
                        {
                            model: Vendor,
                            as: "vendor",
                            attributes: ["id", "user_id"],
                            include: [
                                {
                                    model: User,
                                    as: "user",
                                    attributes: ["id", "name", "email", "phone"]
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ],
    order: [["created_at", "DESC"]],
    limit: 5,
});

/* ===============================
   RESPONSE MAPPING
=============================== */
const criticalCards = criticalQueue.map((r) => ({
    reviewId: r.id,
    rating: r.rating_value,
     status: r.status,
    content: r.content,
    created_at: r.created_at,
    booking_id: r.booking_id,
    flagReason: r.report_reason || "Low rating / Flagged",

    /* ===== CUSTOMER (NO USER TABLE) ===== */
    customer: {
        id: r.customer?.id,
        name: r.customer?.name,
        email: r.customer?.email,
        mobile: r.customer?.phone,
    },

    /* ===== TREK / BATCH ===== */
    trek: {
        trek_id: r.batch?.trek?.id,
        trek_name: r.batch?.trek?.title,
        batch_id: r.batch_id,
        tbr_id: r.batch?.tbr_id,
    },

    /* ===== VENDOR (USER TABLE SE DATA) ===== */
    vendor: {
        vendor_id: r.batch?.trek?.vendor?.id,
        user_id: r.batch?.trek?.vendor?.user?.id,
        name: r.batch?.trek?.vendor?.user?.name,
        email: r.batch?.trek?.vendor?.user?.email,
        mobile: r.batch?.trek?.vendor?.user?.phone,
    }
}));


        /* ===============================
           7. QUALITY & VOLUME TRENDS (GRAPH)
        =============================== */
        const trendsRaw = await Rating.findAll({
            attributes: [
                [sequelize.fn("DATE", sequelize.col("created_at")), "date"],
                [sequelize.fn("COUNT", sequelize.col("id")), "reviewCount"],
                [sequelize.fn("AVG", sequelize.col("rating_value")), "avgRating"],
            ],
            group: [sequelize.fn("DATE", sequelize.col("created_at"))],
            order: [[sequelize.fn("DATE", sequelize.col("created_at")), "ASC"]],
            raw: true,
        });

        const qualityVolumeTrends = trendsRaw.map((t) => ({
            date: t.date,
            reviewVolume: parseInt(t.reviewCount),
            ratingScore: formatOneDecimal(t.avgRating),
        }));

        /* ===============================
           8. RISK SEGMENTATION (VENDORS)
        =============================== */
        const vendorRiskRaw = await Rating.findAll({
            attributes: [
                [sequelize.col("trek.vendor.id"), "vendorId"],
                [sequelize.col("trek.vendor.business_name"), "vendorName"],
                [sequelize.fn("AVG", sequelize.col("rating_value")), "avgRating"],
            ],
            include: [
                {
                    model: Trek,
                    as: "trek",
                     required: true, 
                    attributes: [],
                    include: [
                        {
                            model: Vendor,
                            as: "vendor",
                             required: true, 
                            attributes: [],
                        },
                    ],
                },
            ],
            group: ["trek.vendor.id"],
            raw: true,
        });

        let riskSegmentation = { low: 0, medium: 0, high: 0 };

        vendorRiskRaw.forEach((v) => {
            const rating = parseFloat(v.avgRating);
            if (rating >= 4) riskSegmentation.low++;
            else if (rating >= 2.5) riskSegmentation.medium++;
            else riskSegmentation.high++;
        });

        /* ===============================
           9. TOP DESTINATIONS BY RATING
        =============================== */
        const topDestinationsRaw = await Rating.findAll({
            attributes: [
                 [sequelize.col("trek.id"), "trek_id"],
                [sequelize.fn("AVG", sequelize.col("rating_value")), "avgRating"],
                [sequelize.fn("COUNT", sequelize.col("Rating.id")), "totalReviews"],
            ],
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title"],
                },
            ],
            group: ["trek_id", "trek.id"],
            order: [[sequelize.literal("avgRating"), "DESC"]],
            limit: 4,
        });

        const topDestinations = topDestinationsRaw.map((t) => ({
            trekId: t.trek_id,
            trekName: t.trek?.title,
            avgRating: formatOneDecimal(t.dataValues.avgRating),
            totalReviews: parseInt(t.dataValues.totalReviews),
        }));

        /* ===============================
           10. LEADING VENDORS (RECENT)
        =============================== */
        const leadingVendorsRaw = await Rating.findAll({
            attributes: [
                [sequelize.col("trek.vendor.id"), "vendorId"],
                [sequelize.col("trek.vendor.business_name"), "vendorName"],
                [sequelize.fn("AVG", sequelize.col("rating_value")), "avgRating"],
            ],
            include: [
                {
                    model: Trek,
                    as: "trek",
                     required: true, 
                    attributes: [],
                    include: [
                        {
                            model: Vendor,
                            as: "vendor",
                             required: true, 
                            attributes: [],
                        },
                    ],
                },
            ],
            group: ["trek.vendor.id"],
            order: [[sequelize.literal("avgRating"), "DESC"]],
            limit: 3,
            raw: true,
        });

        const leadingVendors = leadingVendorsRaw.map((v) => ({
            vendorId: v.vendorId,
            vendorName: v.vendorName,
            avgRating: formatOneDecimal(v.avgRating),
        }));

        /* ===============================
           11. SENTIMENT HIGHLIGHTS (BAR)
        =============================== */
        const sentiment = {
            safety: avgCredibility.safetySecurity,
            womenSafety: avgCredibility.womenSafety,
            organizer: avgCredibility.organizerManner,
            planning: avgCredibility.trekPlanning,
        };

        /* ===============================
           FINAL RESPONSE
        =============================== */
        res.json({
            success: true,
            data: {
                summaryCards: {
                    totalReviews,
                    averageRating,
                    avgCredibility,
                    activeIssuesCount,
                },

                criticalQueue: {
                    count: criticalQueueCount,
                    items: criticalCards,
                },

                qualityVolumeTrends,

                riskSegmentation,

                topDestinations,

                leadingVendors,

                sentimentHighlights: sentiment,
            },
        });
   } catch (error) {
        logger.error("admin-review", "Error in admin dashboard analytics:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch admin review dashboard data",
        });
    }
};





exports.updateRatingStatus = async (req, res) => {
    try {
        const { rating_id, status, flag } = req.body;

        /* ================= VALIDATION ================= */
        if (!rating_id) {
            return res.status(400).json({
                success: false,
                message: "rating_id is required"
            });
        }

      
        /* ================= UPDATE ================= */
        const [updatedRows] = await Rating.update(
            {
                status,
                flag
            },
            {
                where: { id: rating_id }
            }
        );

        if (updatedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Rating not found"
            });
        }

        return res.json({
            success: true,
            message: "Rating status updated successfully"
        });

    } catch (error) {
        console.error("Update Rating Status Error:", error);
        return res.status(500).json({
            success: false,
            message: "Database operation failed",
            error: error.message
        });
    }
};




/* =========================================================
   2. ADMIN – GET ALL REVIEWS (LISTING + FILTER + SEARCH)
========================================================= */
exports.getAllReviewsForAdmin = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, status = "all", flagged = "all" } = req.query;
        const offset = (page - 1) * limit;

        const where = {};

        // Status filter
        if (status !== "all") {
            where.status = status;
        }

        // Flagged filter
        if (flagged === "true") {
            where.report = true;
        }

        // Search filter
        if (search && search.trim()) {
            where[Op.or] = [
                { content: { [Op.like]: `%${search}%` } },
                { '$customer.name$': { [Op.like]: `%${search}%` } },
                { '$trek.title$': { [Op.like]: `%${search}%` } },
                { '$trek.vendor.name$': { [Op.like]: `%${search}%` } },
            ];
        }

        const { count, rows } = await Rating.findAndCountAll({
            where,
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title"],
                    include: [
                        {
                            model: Vendor,
                            as: "vendor",
                            attributes: ["id", "name", "email"],
                        },
                    ],
                },
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name", "email", "phone"],
                },
                {
                    model: Booking,
                    as: "booking",
                    attributes: ["id", "total_travelers", "booking_date"],
                },
            ],
            order: [["created_at", "DESC"]],
            limit: parseInt(limit),
            offset: parseInt(offset),
        });

        const formatted = rows.map((r) => ({
            id: `REV-${r.id}`,
            rating_value: r.rating_value,
            content: r.content,
            status: r.status,
            flagged: r.report,
            created_at: r.created_at,

            trek: {
                id: r.trek?.id,
                title: r.trek?.title,
            },

            vendor: {
                id: r.trek?.vendor?.id,
                name: r.trek?.vendor?.name,
                email: r.trek?.vendor?.email,
            },

            customer: {
                id: r.customer?.id,
                name: r.customer?.name,
                email: r.customer?.email,
                phone: r.customer?.phone,
            },

            booking: r.booking
                ? {
                      id: r.booking.id,
                      total_travelers: r.booking.total_travelers,
                      booking_date: r.booking.booking_date,
                  }
                : null,

            categoryRatings: {
                safety: r.safety_security_rated,
                organizer: r.organizer_manner_rated,
                planning: r.trek_planning_rated,
                womenSafety: r.women_safety_rated,
            },
        }));

        res.json({
            success: true,
            reviews: formatted,
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / limit),
            totalCount: count,
        });
    } catch (error) {
        logger.error("admin-review", "Error fetching all reviews:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch reviews",
        });
    }
};

/* =========================================================
   3. ADMIN – CRITICAL QUEUE (FLAGGED + LOW RATING)
========================================================= */
exports.getCriticalQueue = async (req, res) => {
    try {
        const criticalReviews = await Rating.findAll({
            where: {
                [Op.or]: [{ report: true }, { rating_value: { [Op.lte]: 2 } }],
            },
            include: [
                {
                    model: Trek,
                    as: "trek",
                    attributes: ["id", "title"],
                    include: [
                        {
                            model: Vendor,
                            as: "vendor",
                            attributes: ["id", "name", "email"],
                        },
                    ],
                },
                {
                    model: Customer,
                    as: "customer",
                    attributes: ["id", "name", "email"],
                },
            ],
            order: [["created_at", "DESC"]],
        });

        const formatted = criticalReviews.map((r) => ({
            id: `REV-${r.id}`,
            rating_value: r.rating_value,
            content: r.content,
            flagged: r.report,
            created_at: r.created_at,

            trek: r.trek,
            vendor: r.trek?.vendor,
            customer: r.customer,
        }));

        res.json({
            success: true,
            total: formatted.length,
            criticalQueue: formatted,
        });
    } catch (error) {
        logger.error("admin-review", "Error fetching critical queue:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch critical queue",
        });
    }
};
exports.getAdminReviews = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "all",        
      flagged = "all",      
      rating = "all",       
      vendor_id,
      trek_id,
    } = req.query;

    const offset = (page - 1) * limit;

    const ratingWhere = {};

    if (status !== "all") {
      ratingWhere.status = status;
    }

    if (flagged !== "all") {
      ratingWhere.is_flagged = flagged === "true";
    }

    if (rating !== "all") {
      ratingWhere.rating = rating;
    }

    if (search) {
      ratingWhere[Op.or] = [
        { rating_value	: { [Op.like]: `%${search}%` } },
      ];
    }

    const { rows, count } = await Rating.findAndCountAll({
      where: ratingWhere,
      include: [
        {
          model: Customer,
          as: "customer",
       
          where: search
            ? {
                name: { [Op.like]: `%${search}%` },
              }
            : undefined,
          required: false,
        },
        {
          model: Trek,
          as: "trek",
        
          where: trek_id ? { id: trek_id } : undefined,
          include: [
            {
              model: Vendor,
              as: "vendor",
            
              where: vendor_id ? { id: vendor_id } : undefined,
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: Number(limit),
      offset: Number(offset),
      distinct: true,
    });
    return res.status(200).json({
      success: true,
      meta: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / limit),
      },
      data: rows,
    });
  } catch (error) {
    console.error("Admin Reviews Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin reviews",
    });
  }
};


exports.getVendorDirectory = async (req, res) => {
  try {
  const { search = "" } = req.query;
    const vendorWhere = {};
     if (search) {
      vendorWhere[Op.or] = [
        { vin_id: { [Op.like]: `%${search}%` } },

        Sequelize.literal(`
          JSON_UNQUOTE(
            JSON_EXTRACT(company_info, '$.company_name')
          ) LIKE '%${search}%'
        `),
      ];
    }
    const vendors = await Vendor.findAll({
     where: vendorWhere,
      attributes: [
        ["id","vendor_id"],
"vin_id",
      
        "company_info",

       
        [
          Sequelize.fn(
            "ROUND",
            Sequelize.fn("AVG", Sequelize.col("treks.ratings.rating_value")),
            1
          ),
          "avg_rating",
        ],

        // 📝 Total Reviews
        [
          Sequelize.fn("COUNT", Sequelize.col("treks.ratings.id")),
          "total_reviews",
        ],

        // 🗺 Total Treks
        [
          Sequelize.fn(
            "COUNT",
            Sequelize.fn("DISTINCT", Sequelize.col("treks.id"))
          ),
          "total_treks",
        ],
      ],

      include: [
        {
          model: Trek,
          as: "treks",
          attributes: [],
          required: true, // ✅ sirf wahi vendors jinki trek ho
          include: [
            {
              model: Rating,
              as: "ratings",
              attributes: [],
              required: false, // ✅ review ho ya na ho
            },
          ],
        },
      ],

      group: ["Vendor.id"],
      subQuery: false,
    });

    return res.status(200).json({
      success: true,
      data: vendors,
    });
  } catch (error) {
    console.error("Vendor Directory Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch vendor directory",
    });
  }
};

exports.getVendorTrekReviews = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const vendorStats = await Vendor.findOne({
      where: { id: vendorId },
      attributes: [
        "id",
        "vin_id",
        "company_info",
        
        [
          Sequelize.fn(
            "ROUND",
            Sequelize.fn("AVG", Sequelize.col("treks.ratings.rating_value")),
            1
          ),
          "avg_rating",
        ],
        [
          Sequelize.fn("COUNT", Sequelize.col("treks.ratings.id")),
          "total_reviews",
        ],
        [
          Sequelize.fn(
            "COUNT",
            Sequelize.fn("DISTINCT", Sequelize.col("treks.id"))
          ),
          "total_treks",
        ],
      ],
      include: [
        {
          model: Trek,
          as: "treks",
          attributes: [],
          required: false,
          include: [
            {
              model: Rating,
              as: "ratings",
              attributes: [],
              required: false,
            },
          ],
        },
      ],
      group: ["Vendor.id"],
      subQuery: false,
    });

    if (!vendorStats) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    const trekReviews = await Trek.findAll({
      where: { vendor_id: vendorId },
      attributes: [
        "id",
        "title",

        [
          Sequelize.fn(
            "ROUND",
            Sequelize.fn("AVG", Sequelize.col("ratings.rating_value")),
            1
          ),
          "avg_rating",
        ],

        [
          Sequelize.fn("COUNT", Sequelize.col("ratings.id")),
          "total_reviews",
        ],

        [
          Sequelize.fn(
            "SUM",
            Sequelize.literal(`CASE WHEN ratings.report = 1 THEN 1 ELSE 0 END`)
          ),
          "flagged_reviews",
        ],
      ],
      include: [
        {
          model: Rating,
          as: "ratings",
          attributes: [],
          required: false,
        },
      ],
      group: ["Trek.id"],
      subQuery: false,
    });

    return res.status(200).json({
      success: true,
      vendor: {
        id: vendorStats.id,
        vendor_id: vendorStats.vin_id,
company_info: vendorStats.company_info, 
       credibility: vendorStats.get("avg_rating"),
    total_reviews: vendorStats.get("total_reviews"),
    total_treks: vendorStats.get("total_treks"),
      },
      treks: trekReviews,
    });
  } catch (error) {
    console.error("Vendor Trek Review API Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch vendor trek reviews",
    });
  }
};

