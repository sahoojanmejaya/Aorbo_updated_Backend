const {IssueReport,User,Customer,Role,TicketComment,AssignTask,sequelize } = require("../../models");
const { Op, where, col } = require("sequelize");
const moment = require("moment");
exports.getuserbyRoleId = async (req, res) => {
  try {
    const { role_id } = req.params;

    const role = await Role.findByPk(role_id, {
      attributes: ["id", "name" ],
      include: [
        {
          model: User,
          attributes: ["id", "name", "prefix"],
          as:"users"
        },
      ],
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    const formattedRole = role.toJSON();

    formattedRole.prefix =
      typeof formattedRole.prefix === "string"
        ? JSON.parse(formattedRole.prefix)
        : formattedRole.prefix;

    return res.status(200).json({
      msg:"support dashboard data fetched successfully",
      success: true,
      data: formattedRole,
    });
  } catch (error) {
    console.error("Error fetching users by role:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
};
exports.getUserReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { search, status, priority, issue_type, card, ticket_status,type  } = req.query;

    let reportWhere = { assigned_to: id };


    if (status) reportWhere.status = status;
    if (priority) reportWhere.priority = priority;
    if (issue_type) reportWhere.issue_type = issue_type;
 if (ticket_status) reportWhere.ticket_status = ticket_status;
    if (search) {
      reportWhere[Op.or] = [
        { ticket_id: { [Op.like]: `%${search}%` } },
        { issue_category: { [Op.like]: `%${search}%` } },
           { name: { [Op.like]: `%${search}%` } },
      ];

    
    }

    if (card === "active") reportWhere.status = "active";
    if (card === "critical") reportWhere.priority = "critical";
    if (card === "queue") reportWhere.status = "queued";
    if (card === "sla") reportWhere.sla = { [Op.lt]: 0 };

    const user = await User.findByPk(id, {
      include: [
        { model: Role, as: "role", attributes: ["id", "name"] },
        {
          model: IssueReport,
          as: "assignedReports",
          where: reportWhere,
          required: false,
          include: [
            {
              model: Customer,
              as: "customer",
              required: false,
            
            },
          ],
        },
      ],
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }


    const baseWhere = { assigned_to: id };

    const [active, critical, queue, sla] = await Promise.all([
      IssueReport.count({ where: { ...baseWhere, status: "active" } }),
      IssueReport.count({ where: { ...baseWhere, priority: "critical" } }),
      IssueReport.count({ where: { ...baseWhere, status: "queued" } }),
      IssueReport.count({ where: { ...baseWhere, sla: { [Op.lt]: 0 } } }),
    ]);

    return res.json({
      success: true,
      counts: { active, critical, queue, sla },
      data: user,
    });

  } catch (err) {
    console.error("Fetch error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch reports",
      error: err.message,
    });
  }
};
function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);

  const intervals = [
    { label: "year", seconds: 31536000 },
    { label: "month", seconds: 2592000 },
    { label: "day", seconds: 86400 },
    { label: "hour", seconds: 3600 },
    { label: "minute", seconds: 60 },
    { label: "second", seconds: 1 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      return `about ${count} ${interval.label}${count > 1 ? "s" : ""} ago`;
    }
  }

  return "just now";
}

exports.getTicketbyId = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await IssueReport.findByPk(id, {
      include: [
        {
          model: Customer,
          as: "customer",
          required: false,
        },
        {
          model: TicketComment,
          as: "comments",
          required: false,
         
        },
        {
              model: User,
              as: "assignedUser",
              
              required: false,
            },
      ],
  order: [
    [{ model: TicketComment, as: "comments" }, "created_at", "DESC"]
  ],
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    const ticketAge = formatTimeAgo(report.created_at);

    return res.json({
      message: "Ticket data fetched successfully",
      success: true,
      data: {
        ...report.toJSON(),
        ticketAge,
      },
    });

  } catch (err) {
    console.error("Fetch error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch report",
      error: err.message,
    });
  }
};

exports.addComment = async (req, res) => {
     try {
    const { issue_id } = req.params;   // 👈 params se
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({
        success: false,
        message: "Comment is required",
      });
    }

    // Issue exist check
    //const issue = await IssueReport.findByPk(issue_id);
    //if (!issue) {
      //return res.status(404).json({
      //  success: false,
       // message: "Issue report not found",
     // });
   // }

    // Insert comment
    const newComment = await TicketComment.create({
      issue_id,
      comment,
    });

    return res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: newComment,
    });
  } catch (error) {
    console.error("Add Comment Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// if (type === "team_performance") {
//     if (tab === "performance_trends") {
//         return await getPerformanceTrends(req, res); // call the new function
//     } else {
//         return await getAgentPerformance(req, res); // default to agent stats
//     }
// }
exports.getTeamReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { search, status, priority, issue_type, card, ticket_status,type, agent_id,tab, sub_tab  } = req.query;

    let reportWhere = { teamlead_id	: id };
// TAB: Opened Tickets
if (ticket_status === "opened") {
  reportWhere.status = "open";
}

    if (type === "team_performance") {
      switch (sub_tab) {
        case "agent_status":
          return getAgentPerformance(req, res);

        case "performance_trends":
          return getPerformanceTrend(req, res);

        default:
          return res.status(400).json({
            success: false,
            message: "Invalid sub_tab"
          });
      }
    }
const isResolvedTab = type === "resolve_ticket";

if (isResolvedTab) {
  reportWhere.status = "resolved";
}

 if (agent_id) {
      reportWhere.assigned_to = agent_id; // specific agent
    } else {
      reportWhere.assigned_to = { [Op.ne]: null }; // only assigned tickets
    }
    if (status) reportWhere.status = status;
    if (priority) reportWhere.priority = priority;
    if (issue_type) reportWhere.issue_type = issue_type;

    if (search) {
      reportWhere[Op.or] = [
        { ticket_id: { [Op.like]: `%${search}%` } },
        { issue_category: { [Op.like]: `%${search}%` } },
           { name: { [Op.like]: `%${search}%` } },
      ];

    
    }

    if (card === "active") reportWhere.status = "open";
    if (card === "critical") reportWhere.priority = "critical";
    if (card === "queue") reportWhere.status = "queued";
    if (card === "sla") reportWhere.sla = { [Op.lt]: 0 };

    const user = await User.findByPk(id, {
      include: [
        { model: Role, as: "role", attributes: ["id", "name"] },
        {
          model: IssueReport,
          as: "teamLeadReports",
          where: reportWhere,
          required: false,
          include: [
            {
              model: Customer,
              as: "customer",
              required: false,
            
            },
             {
              model: User,
              as: "assignedUser",
              
              required: false,
            },
          ],
        },
      ],
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }


    const baseWhere = { teamlead_id: id };

    const [active, critical, queue, sla] = await Promise.all([
      IssueReport.count({ where: { ...baseWhere, status: "open" } }),
      IssueReport.count({ where: { ...baseWhere, priority: "critical" } }),
      IssueReport.count({ where: { ...baseWhere, status: "queued" } }),
      IssueReport.count({ where: { ...baseWhere, sla: { [Op.lt]: 0 } } }),
    ]);

    return res.json({
      success: true,
      counts: { active, critical, queue, sla },
      data: user,
    });

  } catch (err) {
    console.error("Fetch error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch reports",
      error: err.message,
    });
  }
};
async function getAgentPerformance(req, res) {
  try {
    const { id } = req.params; // team_head id
    const { role ,search} = req.query; // team head / agent

    /* ===============================
       1️⃣ TOP CARDS TOTAL (TEAM BASED)
    ================================*/
    const teamTotals = await IssueReport.findOne({
      where: { teamlead_id: id },
      attributes: [
        [
      sequelize.fn("COUNT", sequelize.fn("DISTINCT", sequelize.col("assigned_to"))),
      "team_active"
    ],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(
              `CASE WHEN IssueReport.status = 'resolved' THEN 1 ELSE 0 END`
            )
          ),
          "team_resolved"
        ],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(
              `CASE WHEN IssueReport.status = 'escalated' THEN 1 ELSE 0 END`
            )
          ),
          "team_escalated"
        ],
        [
          sequelize.fn(
            "AVG",
            sequelize.literal(
              `CASE 
                WHEN IssueReport.status = 'resolved' 
                THEN TIMESTAMPDIFF(MINUTE, IssueReport.created_at, IssueReport.resolved_at)
              END`
            )
          ),
          "team_avg_time"
        ]
      ],
      raw: true
    });

    /* ===============================
       2️⃣ AGENT PERFORMANCE TABLE
       (UNCHANGED - WORKING CODE)
    ================================*/
    const team_lead = await IssueReport.findAll({
      where: { teamlead_id: id },

      attributes: [
        "assigned_to",
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(
              `CASE WHEN IssueReport.status = 'active' THEN 1 ELSE 0 END`
            )
          ),
          "active"
        ],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(
              `CASE WHEN IssueReport.status = 'resolved' THEN 1 ELSE 0 END`
            )
          ),
          "resolved"
        ],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(
              `CASE WHEN IssueReport.status = 'escalated' THEN 1 ELSE 0 END`
            )
          ),
          "escalated"
        ],
        [
          sequelize.fn(
            "AVG",
            sequelize.literal(
              `CASE 
                WHEN IssueReport.status = 'resolved' 
                THEN TIMESTAMPDIFF(MINUTE, IssueReport.created_at, IssueReport.resolved_at)
              END`
            )
          ),
          "avg_time"
        ]
      ],

     include: [
  {
    model: User,
    as: "assignedUser",
    attributes: ["id", "name", "email", "prefix"],
    required: true,
    ...(search
      ? {
          where: {
            name: {
              [Op.like]: `%${search}%`,
            },
          },
        }
      : {}),
  },
],


      group: ["IssueReport.teamlead_id", "assignedUser.id"],
      raw: true
    });

    /* ===============================
       3️⃣ TEAM HEAD VIEW (ONLY IF SELECTED)
    ================================*/
    let finalAgents = team_lead.map(a => ({
      team_lead_id: a.assigned_to,
      name: a["assignedUser.name"],
      email: a["assignedUser.email"],
      role: a["assignedUser.prefix"],
      active: Number(a.active),
      resolved: Number(a.resolved),
      escalated: Number(a.escalated),
      avg_time: a.avg_time
        ? `${Math.floor(a.avg_time / 60)}h ${Math.floor(a.avg_time % 60)}m`
        : "N/A"
    }));

    if (role === "team head") {
  teamHead = await User.findOne({
    where: {
      id,
      ...(search
        ? { name: { [Op.like]: `%${search}%` } }
        : {}),
    },
  });

  if (!teamHead) {
    return res.json({
      success: true,
      type: "team_performance",
      cards: {},
      teams: [],
    });
  }

  const avgMinutes = Number(teamTotals.team_avg_time);

  finalAgents = [
    {
      agent_id: id,
      name: teamHead.name,
      email: teamHead.email,
      role: teamHead.prefix,
      active: Number(teamTotals.team_active || 0),
      resolved: Number(teamTotals.team_resolved || 0),
      escalated: Number(teamTotals.team_escalated || 0),
      avg_time: avgMinutes
        ? `${Math.floor(avgMinutes / 60)}h ${Math.floor(avgMinutes % 60)}m`
        : "N/A",
    },
  ];
}

const responseKey = role === "team head" ? "teams" : "agents";
    /* ===============================
       4️⃣ FINAL RESPONSE (UI READY)
    ================================*/
    return res.json({
      success: true,
      type: "team_performance",

      cards: {
        team_active: Number(teamTotals.team_active || 0),
        team_resolved: Number(teamTotals.team_resolved || 0),
        team_escalated: Number(teamTotals.team_escalated || 0),
        team_avg_time: teamTotals.team_avg_time
          ? `${Math.floor(teamTotals.team_avg_time / 60)}h ${Math.floor(teamTotals.team_avg_time % 60)}m`
          : "N/A"
      },

      [responseKey]: finalAgents
    });

  } catch (error) {
    console.error("TEAM PERF ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch team performance",
      error: error.message
    });
  }
}
function fillDays(raw, days) {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = moment().subtract(i, "days").format("YYYY-MM-DD");
    const found = raw.find(r => r.date === date);
    result.push({ date, value: found ? Number(found.value) : 0 });
  }
  return result;
}

async function getPerformanceTrend(req, res) {
  try {
    const { id } = req.params; // teamlead id
    const { days = 7, performance_agent_id, performance_status, metric = "resolved" } = req.query;

    const startDate = moment()
      .subtract(days - 1, "days")
      .startOf("day")
      .toDate();

    const endDate = moment().endOf("day").toDate();

    // ===============================
    // 1️⃣ Filter for tickets
    // ===============================
    const ticketFilter = {
      teamlead_id: id,
      created_at: { [Op.between]: [startDate, endDate] }
    };
const agentId = performance_agent_id
  ? performance_agent_id.split(",").map(id => Number(id))
  : [];

if (agentId.length > 0) {
  ticketFilter.assigned_to = { [Op.in]: agentId };
}
  

    if (performance_status) {
    ticketFilter.status = performance_status;
    }

    // ===============================
    // 2️⃣ PERFORMANCE TREND (METRIC BASED)
    // ===============================
    let trendRaw = [];

    // 👉 Tickets Resolved
    if (metric === "resolved") {
      trendRaw = await IssueReport.findAll({
        attributes: [
          [sequelize.fn("DATE", sequelize.col("resolved_at")), "date"],
          [sequelize.fn("COUNT", sequelize.col("id")), "value"]
        ],
        where: {
          ...ticketFilter,
          status: "resolved",
          resolved_at: { [Op.ne]: null }
        },
        group: ["date"],
        raw: true
      });
    }

    // 👉 Avg Resolution Time (minutes)
    if (metric === "avg_time") {
      trendRaw = await IssueReport.findAll({
        attributes: [
          [sequelize.fn("DATE", sequelize.col("IssueReport.resolved_at")), "date"],
          [
            sequelize.fn(
              "AVG",
              sequelize.literal(
                `CASE
              WHEN IssueReport.resolved_at >= IssueReport.created_at
              THEN TIMESTAMPDIFF(MINUTE, IssueReport.created_at, IssueReport.resolved_at)
              ELSE NULL
            END`
              )
            ),
            "value"
          ]
        ],
        where: {
          ...ticketFilter,
          status: "resolved",
          resolved_at: { [Op.ne]: null }
        },
        group: ["date"],
        raw: true
      });
    }

    const performanceTrend = fillDays(trendRaw, days);

    // ===============================
    // 3️⃣ SLA Breach Trend
    // ===============================
    const slaBreachRaw = await IssueReport.findAll({
      attributes: [
        [sequelize.fn("DATE", sequelize.col("IssueReport.created_at")), "date"],
        [sequelize.fn("COUNT", sequelize.col("id")), "value"]
      ],
      where: {
        ...ticketFilter,
        sla: { [Op.lt]: 0 }
      },
      group: ["date"],
      raw: true
    });

    const slaBreachTrend = fillDays(slaBreachRaw, days);

    // ===============================
    // 4️⃣ SLA Warning Trend
    // ===============================
    const slaWarningRaw = await IssueReport.findAll({
      attributes: [
        [sequelize.fn("DATE", sequelize.col("IssueReport.created_at")), "date"],
        [sequelize.fn("COUNT", sequelize.col("id")), "value"]
      ],
      where: {
        ...ticketFilter,
        sla: { [Op.between]: [1, 30] }
      },
      group: ["date"],
      raw: true
    });

    const slaWarningTrend = fillDays(slaWarningRaw, days);

    // ===============================
    // 5️⃣ Agent Comparison
    // ===============================
    const agentStatsRaw = await IssueReport.findAll({
      attributes: [
        "assigned_to",
        [sequelize.fn("SUM", sequelize.literal(`IssueReport.status='resolved'`)), "resolved"],
        [sequelize.fn("SUM", sequelize.literal(`IssueReport.status='active'`)), "active"],
        [sequelize.fn("SUM", sequelize.literal(`IssueReport.status='escalated'`)), "escalated"],
        [
          sequelize.fn(
            "AVG",
            sequelize.literal(
              `TIMESTAMPDIFF(MINUTE, IssueReport.created_at, IssueReport.resolved_at)`
            )
          ),
          "avg_time"
        ]
      ],
     where: {
  teamlead_id: id,
  ...(agentId.length > 0 && { assigned_to: { [Op.in]: agentId } }),
  ...(performance_status && { status: performance_status })
},



      group: ["assigned_to"],
      include: [
        {
          model: User,
          as: "assignedUser",
          attributes: ["id", "name"]
        }
      ],
      raw: true
    });

    // ===============================
    // 6️⃣ Agents list for checkbox
    // ===============================
    const agentIdsRaw = await IssueReport.findAll({
      where: { teamlead_id: id },
      attributes: [[sequelize.fn("DISTINCT", sequelize.col("assigned_to")), "id"]],
      raw: true
    });

    const agentIds = agentIdsRaw.map(a => a.id).filter(Boolean);

    //const agents = await User.findAll({
     // where: { id: agentIds },
   //   attributes: ["id", "name"]
    //});

    // ===============================
    // 7️⃣ Top Metric Cards
    // ===============================
    let ticketMetrics = {};

    if (metric === "resolved") {
      const resolvedCount = await IssueReport.count({
        where: { ...ticketFilter, status: "resolved" }
      });

      const avgTimeRaw = await IssueReport.findOne({
        attributes: [
          [
            sequelize.fn(
              "AVG",
              sequelize.literal(
                `TIMESTAMPDIFF(MINUTE, IssueReport.created_at, IssueReport.resolved_at)`
              )
            ),
            "avg_time"
          ]
        ],
        where: { ...ticketFilter, status: "resolved" },
        raw: true
      });

      ticketMetrics = {
        totalResolved: resolvedCount,
        avgResolutionTime: Number(avgTimeRaw?.avg_time || 0)
      };
    }

    // ===============================
    // 8️⃣ Final Response (UNCHANGED)
    // ===============================
    return res.json({
      success: true,
      data: {
        performanceTrend,
        
        slaBreachTrend,
        slaWarningTrend,
        agentStats: agentStatsRaw,
       // agents,
        ticketMetrics
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}

exports.getActivityHistory = async (req, res) => {
  try {
    const { id } = req.params;

    // 1️⃣ get role from DB
    const user = await User.findByPk(id, {
      attributes: ["id", "prefix"]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const role = user.prefix; // agent | team head

    const startDate = moment()
      .subtract(1, "month")
      .startOf("day")
      .toDate();

    const whereCondition = {
      created_at: { [Op.gte]: startDate }
    };

    // 2️⃣ role-based condition
    if (role === "agent") {
       whereCondition[Op.or] = [
    { agent_id: id },        // received tickets
    { from_agent_id: id }    // reassigned tickets
  ];
    } else if (role === "team head") {
      whereCondition.teamlead_id = id;
    }

    const activities = await AssignTask.findAll({
      where: whereCondition,
      include: [
        {
          model: IssueReport,
          as: "issue",
          attributes: [
            "ticket_id",
            "issue_category",
            "reason",
            "name",
            "source",
            "ticket_status"
          ]
        }
      ],
      order: [["created_at", "DESC"]]
    });

    const groupedData = {};

    activities.forEach((row) => {
      const activityDate = moment(row.created_at);
      const today = moment().startOf("day");
      const yesterday = moment().subtract(1, "day").startOf("day");

      let label;
      if (activityDate.isSame(today, "day")) label = "TODAY";
      else if (activityDate.isSame(yesterday, "day")) label = "YESTERDAY";
      else label = activityDate.format("DD MMM YYYY");

      if (!groupedData[label]) groupedData[label] = [];

      groupedData[label].push({
      id: row.id,
        time: activityDate.format("hh:mm A"),
        ticket_id: row.issue?.ticket_id,
        action: row.status,
        action_type: row.assign_status || "auto",
        issue_reason:
          row.issue?.reason || row.issue?.issue_category || "-",
        requester: {
          name: row.issue?.name || "Guest User",
        },
        
        
      });
    });

    return res.status(200).json({
      success: true,
      role,
      range: "LAST_1_MONTH",
      data: groupedData
    });
  } catch (error) {
    console.error("ACTIVITY HISTORY ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch activity history"
    });
  }
};


exports.updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason} = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ticket_id is required in params"
      });
    }

    // Validate status
    const validStatuses = ["open", "in_progress", "resolved", "closed", "escalated"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      });
    }

    // Optional: validate priority if provided
    

    // Find the issue report
    const issue = await IssueReport.findOne({ where: { id: id } });
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found"
      });
    }

    // Update fields
    if (status) {
      issue.status = status;

      // If status is resolved, set resolved_at to current timestamp
      if (status === "resolved") {
        issue.resolved_at = new Date(); // current timestamp
      }
    }

    if (reason) issue.reason = reason;

    await issue.save();

    res.status(200).json({
      success: true,
      message: "Ticket updated successfully",
     
    });

  } catch (error) {
    console.error("Error updating ticket status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


