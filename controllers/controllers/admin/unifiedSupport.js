const {IssueReport,User,Customer,Role,TicketComment,sequelize } = require("../../models");
const { Op, where, col } = require("sequelize");
exports.getUnifiedSupport = async (req, res) => {
  try {
    const { type, search, status, priority, issue_type } = req.query;

    //if (!["feed", "vendor", "customer", "logs"].includes(type)) {
     // return res.status(400).json({
        //success: false,
      //  message: "Invalid type",
     // });
   // }

    /* ====================================================
       TAB 1️⃣ ALL TICKETS (VENDOR + CUSTOMER)
    ====================================================*/
    if (type === "feed") {
      let where = {};

      if (status) where.status = status;
      if (priority) where.priority = priority;
      if (issue_type) where.issue_type = issue_type;

      if (search) {
        where[Op.or] = [
          { ticket_id: { [Op.like]: `%${search}%` } },
          { issue_category: { [Op.like]: `%${search}%` } },
          { name: { [Op.like]: `%${search}%` } },
        ];
      }

      const tickets = await IssueReport.findAll({
        where,
        include: [
          { model: User, as: "assignedUser", attributes: ["id", "name"] },
          { model: Customer, as: "customer", required: false },
          { model: Vendor, as: "vendor", required: false },
        ],
        order: [["created_at", "DESC"]],
      });

      return res.json({
        success: true,
        tab: "feed",
        total: tickets.length,
        tickets,
      });
    }

    /* ====================================================
       TAB 2️⃣ VENDOR OPS
    ====================================================*/
   if (type === "vendor") {
  const { page = 1, limit = 10, search } = req.query;
  const offset = (page - 1) * limit;

  /* ====================================================
     1️⃣ VENDOR SUPPORT FEED (TOP TABLE)
  ====================================================*/
  let feedWhere = {
    vendor_id: { [Op.ne]: null },
  };

  if (search) {
    feedWhere[Op.or] = [
      { ticket_id: { [Op.like]: `%${search}%` } },
      { issue_category: { [Op.like]: `%${search}%` } },
      { name: { [Op.like]: `%${search}%` } },
    ];
  }

  const feed = await IssueReport.findAndCountAll({
    where: feedWhere,
    include: [
      
      {
        model: User,
        as: "assignedUser",
        attributes: ["id", "name"],
        required: false,
      },
    ],
    order: [["created_at", "DESC"]],
    limit: Number(limit),
    offset: Number(offset),
  });

  /* ====================================================
     2️⃣ VENDOR OPS EFFICIENCY (BOTTOM TABLE)
  ====================================================*/
  const ops = await IssueReport.findAll({
    where: {
      vendor_id: { [Op.ne]: null },
    },
    attributes: [
      "assigned_to",
      [sequelize.fn("COUNT", sequelize.col("IssueReport.id")), "total_assigned"],
      [
        sequelize.fn(
          "SUM",
          sequelize.literal(`CASE WHEN IssueReport.status='resolved' THEN 1 ELSE 0 END`)
        ),
        "resolved",
      ],
      [
        sequelize.fn(
          "SUM",
          sequelize.literal(`CASE WHEN IssueReport.status='escalated' THEN 1 ELSE 0 END`)
        ),
        "escalated",
      ],
    ],
    include: [
      {
        model: User,
        as: "assignedUser",
        attributes: ["id", "name"],
        required: false,
      },
    ],
    group: ["assigned_to", "assignedUser.id"],
    raw: true,
  });

  return res.json({
    success: true,
    tab: "vendor",

    /* 🔝 TOP TABLE */
    feed: {
      total: feed.count,
      page: Number(page),
      limit: Number(limit),
      rows: feed.rows,
    },

    /* 🔽 BOTTOM TABLE */
    vendor_ops: ops.map((row) => ({
      assigned_to: row.assigned_to,
      agent_name: row["assignedUser.name"] || null,
      total_assigned: Number(row.total_assigned),
      resolved: Number(row.resolved),
      escalated: Number(row.escalated),
      resolution_rate:
        row.total_assigned > 0
          ? Math.round((row.resolved / row.total_assigned) * 100)
          : 0,
    })),
  });
}


    /* ====================================================
       TAB 3️⃣ CUSTOMER OPS
    ====================================================*/
    if (type === "customer") {
     const { page = 1, limit = 10, search } = req.query;
  const offset = (page - 1) * limit;

  /* ====================================================
     1️⃣ VENDOR SUPPORT FEED (TOP TABLE)
  ====================================================*/
  let feedWhere = {
    customer_id: { [Op.ne]: null },
  };

  if (search) {
    feedWhere[Op.or] = [
      { ticket_id: { [Op.like]: `%${search}%` } },
      { issue_category: { [Op.like]: `%${search}%` } },
      { name: { [Op.like]: `%${search}%` } },
    ];
  }

  const feed = await IssueReport.findAndCountAll({
    where: feedWhere,
    include: [
      
      {
        model: User,
        as: "assignedUser",
        attributes: ["id", "name"],
        required: false,
      },
    ],
    order: [["created_at", "DESC"]],
    limit: Number(limit),
    offset: Number(offset),
  });

  /* ====================================================
     2️⃣ VENDOR OPS EFFICIENCY (BOTTOM TABLE)
  ====================================================*/
  const ops = await IssueReport.findAll({
    where: {
      customer_id: { [Op.ne]: null },
    },
    attributes: [
      "assigned_to",
      [sequelize.fn("COUNT", sequelize.col("IssueReport.id")), "total_assigned"],
      [
        sequelize.fn(
          "SUM",
          sequelize.literal(`CASE WHEN IssueReport.status='resolved' THEN 1 ELSE 0 END`)
        ),
        "resolved",
      ],
      [
        sequelize.fn(
          "SUM",
          sequelize.literal(`CASE WHEN IssueReport.status='escalated' THEN 1 ELSE 0 END`)
        ),
        "escalated",
      ],
    ],
    include: [
      {
        model: User,
        as: "assignedUser",
        attributes: ["id", "name"],
        required: false,
      },
    ],
    group: ["assigned_to", "assignedUser.id"],
    raw: true,
  });

  return res.json({
    success: true,
    tab: "customer",

    /* 🔝 TOP TABLE */
    feed: {
      total: feed.count,
      page: Number(page),
      limit: Number(limit),
      rows: feed.rows,
    },

    /* 🔽 BOTTOM TABLE */
    customer_care: ops.map((row) => ({
      assigned_to: row.assigned_to,
      agent_name: row["assignedUser.name"] || null,
      total_assigned: Number(row.total_assigned),
      resolved: Number(row.resolved),
      escalated: Number(row.escalated),
      resolution_rate:
        row.total_assigned > 0
          ? Math.round((row.resolved / row.total_assigned) * 100)
          : 0,
    })),
  });
    }

    /* ====================================================
       TAB 4️⃣ ACTIVITY LOGS
    ====================================================*/
   if (type === "logs") {
  try {
    /* ================================
       1️⃣ CUSTOMER SUPPORT AGENTS
    =================================*/
    const customerAgents = await IssueReport.findAll({
      where: {
        customer_id: { [Op.ne]: null },
        assigned_to: { [Op.ne]: null },
      },
      attributes: [
        "assigned_to",
        [sequelize.fn("COUNT", sequelize.col("IssueReport.id")), "total_tickets"],
      ],
      include: [
        {
          model: User,
          as: "assignedUser",
          attributes: ["id", "name", "email", "phone","created_at"],
          required: true,
        },
      ],
      group: ["assigned_to", "assignedUser.id"],
      raw: true,
    });

    /* ================================
       2️⃣ VENDOR SUPPORT AGENTS
    =================================*/
    const vendorAgents = await IssueReport.findAll({
      where: {
        vendor_id: { [Op.ne]: null },
        assigned_to: { [Op.ne]: null },
      },
      attributes: [
        "assigned_to",
        [sequelize.fn("COUNT", sequelize.col("IssueReport.id")), "total_tickets"],
      ],
      include: [
        {
          model: User,
          as: "assignedUser",
          attributes: ["id", "name", "email", "phone","created_at"],
          required: true,
        },
      ],
      group: ["assigned_to", "assignedUser.id"],
      raw: true,
    });

    return res.json({
      success: true,
      tab: "logs",

      customer_support_registry: customerAgents,

      vendor_support_registry: vendorAgents
    });
  } catch (err) {
    console.error("Logs error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch logs",
      error: err.message,
    });
  }
}

  } catch (err) {
    console.error("Admin unified support error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin support data",
      error: err.message,
    });
  }
};


exports.getTicketsByAgent = async (req, res) => {
  try {
    const { agent_id } = req.params; // agent assigned_to
    const { page = 1, limit = 20 } = req.query;

    const offset = (page - 1) * limit;

    if (!agent_id) {
      return res.status(400).json({ success: false, message: "agent_id is required" });
    }

    // Build dynamic filters
    let where = {
      assigned_to: agent_id,
    };

    

    //if (search) {
    //  where[Op.or] = [
    //    { ticket_id: { [Op.like]: `%${search}%` } },
      //  { issue_category: { [Op.like]: `%${search}%` } },
       // { name: { [Op.like]: `%${search}%` } },
       // sequelize.where(sequelize.col("assignedUser.name"), { [Op.like]: `%${search}%` }),
     // ];
    //}

    // Fetch tickets
    const tickets = await IssueReport.findAndCountAll({
      where,
      include: [
        { model: User, as: "assignedUser", attributes: ["id", "name"], required: false },
        
      ],
      order: [["created_at", "DESC"]],
      limit: Number(limit),
      offset: Number(offset),
    });

    return res.json({
      success: true,
      agent_id,
      total: tickets.count,
      page: Number(page),
      limit: Number(limit),
      tickets: tickets.rows,
    });
  } catch (err) {
    console.error("Get tickets by agent error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch tickets",
      error: err.message,
    });
  }
};


