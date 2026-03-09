const { IssueReport,User,AssignTask,sequelize,Booking,Trek, Customer,Vendor } = require("../../models");

const { Op } = require("sequelize");


async function assign_task ({ issue_report_id, team_type }) {
  const t = await sequelize.transaction();

  try {
    const issue = await IssueReport.findByPk(issue_report_id, { transaction: t });
    if (!issue) throw new Error("Issue not found");

    const lead = await User.findOne({
      where: {
        role_id: team_type,
        prefix: "team head",
        status: "active"
      },
      transaction: t
    });
    if (!lead) throw new Error("No active Team Head found");

    const agents = await User.findAll({
      where: {
        role_id: team_type,
        prefix: "agent",
        status: "active"
      },
      transaction: t
    });
    if (!agents.length) throw new Error("No active agent found");

    let selectedAgent = agents[0];
    let minTasks = Infinity;

    for (const agent of agents) {
      const count = await AssignTask.count({
        where: { agent_id: agent.id, status: "assigned" },
        transaction: t
      });

    if (count < 25 && count < minTasks) {
        minTasks = count;
        selectedAgent = agent;
      }
    }

   
    if (!selectedAgent) {
      await IssueReport.update(
        {
          queue_status: "queue",
          status: "open"
        },
        { where: { id: issue_report_id }, transaction: t }
      );

      await t.commit();
      return { assigned: false };
    }


    await IssueReport.update(
      {
        assigned_to: selectedAgent.id,
        teamlead_id: lead.id,
        status: "open",
        queue_status: "assigned"
      },
      { where: { id: issue_report_id }, transaction: t }
    );

   
    await IssueReport.update(
      {
        assigned_to: selectedAgent.id,
        teamlead_id: lead.id,
        status: "open"
      },
      { where: { id: issue_report_id }, transaction: t }
    );

    // assign task -> ASSIGNED
    await AssignTask.create(
      {
        issue_report_id,
        agent_id: selectedAgent.id,
        teamlead_id: lead.id,
        status: "assigned"
      },
      { transaction: t }
    );

    await t.commit();
    return true;

  } catch (error) {
    await t.rollback();
    throw error;
  }
}
const generateTicketId = () => {
  const prefix = "TKT";
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${Date.now()}-${random}`;
};


exports.submitIssueReport = async (req, res) => {
    try {
        const {
            name,
            phone_number,
            email,vendor_id,status,
            booking_id, // TIN/Trip ID
            issue_type,
            issue_category,
            description,
            priority,
            sla
        } = req.body;

        // Validate required fields
        if (!name || !phone_number || !email || !booking_id || !issue_type) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: name, phone_number, email, booking_id, and issue_type are required",
                required_fields: ["name", "phone_number", "email", "booking_id", "issue_type"]
            });
        }

        // Validate issue_type enum
        const validIssueTypes = ["accommodation_issue", "trek_services_issue", "transportation_issue", "technical_issue","accounts_issue"];
        if (!validIssueTypes.includes(issue_type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid issue_type. Must be one of: accommodation_issue, trek_services_issue, transportation_issue, other",
                valid_types: validIssueTypes
            });
        }

        // Validate issue_category if provided
        if (issue_category) {
            const validCategories = ['drunken_driving','rash_unsafe_driving','sexual_harassment','verbal_abuse_assault','others','Payment Failure (UPI/Netbanking)','GST invoice Mismatch','Delivery Delay (Logistics)','Portal Login Issue','Technical Bug'];
            if (!validCategories.includes(issue_category)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid issue_category. Must be one of: drunken_driving, rash_unsafe_driving, sexual_harassment, verbal_abuse_assault, others",
                    valid_categories: validCategories
                });
            }
        }

        // Validate priority if provided
        if (priority) {
            const validPriorities = ["low", "medium", "high", "urgent"];
            if (!validPriorities.includes(priority)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid priority. Must be one of: low, medium, high, urgent",
                    valid_priorities: validPriorities
                });
            }
        }

        // Verify that the booking exists
        const booking = await Booking.findByPk(booking_id, {
            include: [
                { model: Customer, as: "customer" },
                { model: Trek, as: "trek" },
                { model: Vendor, as: "vendor" }
            ]
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found. Please verify the TIN/Trip ID",
                booking_id: booking_id
            });
        }

        // Try to find customer by email or phone to link the issue report
        let customer_id = null;
        if (booking.customer_id) {
            customer_id = booking.customer_id;
        } else {
            // Try to find customer by email or phone
            const existingCustomer = await Customer.findOne({
                where: {
                    [Op.or]: [
                        { email: email },
                        { phone: phone_number }
                    ]
                }
            });
            if (existingCustomer) {
                customer_id = existingCustomer.id;
            }
        }

        // Determine priority - use provided priority or set based on issue type
        let finalPriority = priority;
        if (!finalPriority) {
            finalPriority = issue_type === "other" ? "medium" : "high"; // Set higher priority for specific issues
        }

        // Get booking total_amount to store in disputed_amount
        // Use total_amount from bookings table (not final_amount)
        const bookingTotalAmount = parseFloat(
            booking.total_amount || 
            0
        );

        console.log("🔍 Booking amount details:", {
            booking_id: booking_id,
            total_amount: booking.total_amount,
            disputed_amount_to_store: bookingTotalAmount
        });
const ticket_id = generateTicketId();
        // Create the issue report with disputed_amount from booking total amount
        const issueReport = await IssueReport.create({
            ticket_id: ticket_id,
            booking_id: booking_id,
            customer_id: customer_id,
             vendor_id: vendor_id,
            name: name.trim(),
            phone_number: phone_number.trim(),
            email: email.trim(),
            issue_type: issue_type,
            issue_category: issue_category || null,
            description: description ? description.trim() : null,
            status: "open", // Default status is now "open"
            priority: finalPriority,
            sla: sla || null,
            disputed_amount: bookingTotalAmount, // Store booking's total amount in disputed_amount
            favoue_status: "No Action" // Set default favour_status as "No Action"
        });
const ISSUE_TEAM_MAP = {
  technical_issue: 4,
  accounts_issue: 5
};

const team_type = ISSUE_TEAM_MAP[issue_type];

if (team_type) {
  try {
    await assign_task({
      issue_report_id: issueReport.id,
      team_type
    });
  } catch (err) {
    console.error("Auto assignment failed:", err.message);
  }
}
const finalIssueReport = await IssueReport.findByPk(issueReport.id, {
  include: [
    {
      model: User,
      as: "assignedUser",
      attributes: ["id", "name", "email"]
    }
  ]
});
const io = req.app.get("io");

io.emit("ticket_assigned", {
  ticket_id: issueReport.ticket_id,
  issue_id: issueReport.id,
  assigned_to: finalIssueReport.assignedUser?.id,
  priority: issueReport.priority,
  status: issueReport.status,
  created_at: issueReport.created_at
});

        // Return success response with issue report details
        res.status(201).json({
            success: true,
            message: "Issue report submitted successfully",
            data: {
                issue_id: issueReport.id,
                booking_id: issueReport.booking_id,
                issue_type: issueReport.issue_type,
                  ticket_id: issueReport.ticket_id,
                issue_category: issueReport.issue_category,
                status: issueReport.status,
                priority: issueReport.priority,
                sla: issueReport.sla,
            //assigned_to:48,
               assigned_to: finalIssueReport.assignedUser,
                disputed_amount: issueReport.disputed_amount || bookingTotalAmount,
                favoue_status: issueReport.favoue_status || "No Action",
                created_at: issueReport.created_at,
                booking_info: {
                    trek_name: booking.trek?.name,
                    vendor_name: booking.vendor?.business_name,
                    booking_date: booking.booking_date,
                    booking_amount: bookingTotalAmount
                }
            }
        });

    } catch (error) {
        console.error("Error submitting issue report:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while submitting issue report",
            error: process.env.NODE_ENV === "development" ? error.message : "Something went wrong"
        });
    }
}
exports.assignTask = async (req, res) => {
  const { ticket_ids, team_type, type, agent_id } = req.body;

  if (!type || !["quick", "auto"].includes(type)) {
    return res.status(400).json({ message: "type must be quick or auto" });
  }

  const t = await sequelize.transaction();

  try {
    let results = [];

    /* ================= QUICK REASSIGN ================= */
    if (type === "quick") {
      if (!agent_id || !Array.isArray(ticket_ids) || !ticket_ids.length) {
        return res.status(400).json({
          message: "agent_id and ticket_ids required"
        });
      }

      const newAgent = await User.findOne({
        where: {
          id: agent_id,
          prefix: "Agent",
          role_id: team_type,
          status: "active"
        },
        transaction: t
      });

      if (!newAgent) {
        return res.status(404).json({ message: "Agent not found for this team" });
      }

      const teamLead = await User.findOne({
        where: {
          role_id: team_type,
          prefix: "team head",
          status: "active"
        },
        transaction: t
      });

      for (const issue_report_id of ticket_ids) {
        const activeAssign = await AssignTask.findOne({
          where: {
            issue_report_id,
            status: { [Op.in]: ["assigned"] }
          },
          transaction: t
        });

        if (!activeAssign) {
          results.push({
            issue_report_id,
            success: false,
            message: "No active assignment found"
          });
          continue;
        }

        const previousAgentId = activeAssign.agent_id;

        // 1️⃣ OLD AGENT → reassigned
        await activeAssign.update({
          status: "reassigned"
        }, { transaction: t });

        // 2️⃣ NEW AGENT → received
        await AssignTask.create({
          issue_report_id,
          agent_id: newAgent.id,
          from_agent_id: previousAgentId,
          teamlead_id: teamLead ? teamLead.id : null,
          status: "received",
          assign_status: "quick"
        }, { transaction: t });

        // 3️⃣ Update issue_report (current owner)
        await IssueReport.update({
          assigned_to: newAgent.id,
          teamlead_id: teamLead ? teamLead.id : null,
          status: "active"
        }, {
          where: { id: issue_report_id },
          transaction: t
        });

        results.push({
          issue_report_id,
          from_agent: previousAgentId,
          to_agent: newAgent.id,
          status: "received",
          success: true
        });
      }
    }

    /* ================= AUTO REASSIGN ================= */
    if (type === "auto") {
      if (!agent_id) {
        return res.status(400).json({ message: "agent_id required" });
      }

      // All active tickets of source agent
      const activeTasks = await AssignTask.findAll({
        where: {
          agent_id,
          status: { [Op.in]: ["assigned", "received"] }
        },
        transaction: t
      });

      if (!activeTasks.length) {
        return res.status(404).json({ message: "No active tickets found" });
      }

      const agents = await User.findAll({
        where: {
          role_id: team_type,
          prefix: "Agent",
          status: "active",
          id: { [Op.ne]: agent_id }
        },
        transaction: t
      });

      if (!agents.length) {
        return res.status(404).json({ message: "No other agents available" });
      }

      // Load balancing
      const agentLoad = {};
      for (const agent of agents) {
        agentLoad[agent.id] = await AssignTask.count({
          where: {
            agent_id: agent.id,
            status: { [Op.in]: ["assigned", "received"] }
          },
          transaction: t
        });
      }

      for (const task of activeTasks) {
        const selectedAgent = agents.reduce((a, b) =>
          agentLoad[a.id] <= agentLoad[b.id] ? a : b
        );

        agentLoad[selectedAgent.id]++;

        // 1️⃣ OLD AGENT → reassigned
        await AssignTask.update({
          status: "reassigned",
          from_agent_id: task.agent_id,
        }, {
          where: { id: task.id },
          transaction: t
        });

        // 2️⃣ NEW AGENT → received
       // await AssignTask.create({
         // issue_report_id: task.issue_report_id,
         // agent_id: selectedAgent.id,
          //from_agent_id: task.agent_id,
         // teamlead_id: task.teamlead_id,
         // status: "received",
         // assign_status: "auto"
        //}, { transaction: t });

        // 3️⃣ Issue report update
        await IssueReport.update({
          assigned_to: selectedAgent.id,
          status: "active"
    
        }, {
          where: { id: task.issue_report_id },
          transaction: t
        });

        results.push({
          issue_report_id: task.issue_report_id,
          from_agent: task.agent_id,
          to_agent: selectedAgent.id,
          status: "reassigned",
          success: true
        });
      }
    }

    await t.commit();
    return res.json({ success: true, results });

  } catch (error) {
    await t.rollback();
    console.error("ASSIGN ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};



exports.getReportsByVendor = async (req, res) => {
  try {
    const { vendor_id } = req.params;
    const { status, priority, issue_type, search, page, limit } = req.query;

    if (!vendor_id) {
      return res.status(400).json({
        success: false,
        message: "vendor_id is required"
      });
    }

    // Pagination defaults
    const pageNum = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 20;
    const offset = (pageNum - 1) * pageSize;

    // Build where clause for filtering
    const whereClause = {};

    if (status) whereClause.status = status;
    if (priority) whereClause.priority = priority;
    if (issue_type) whereClause.issue_type = issue_type;

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { ticket_id: { [Op.like]: `%${search}%` } }
      ];
    }

    // Fetch reports
    const { rows: reports, count: total } = await IssueReport.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Booking,
          as: 'booking',
          where: { vendor_id },
          include: [
            { model: Vendor, as: 'vendor', attributes: ['id', 'business_name'] },
            { model: Customer, as: 'customer', attributes: ['id', 'name', 'email', 'phone'] }
          ]
        },
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'teamlead',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['created_at', 'DESC']],
      offset,
      limit: pageSize
    });

    res.status(200).json({
      success: true,
      message: "Reports fetched successfully",
      data: reports.map(r => ({
        id: r.id,
        ticket_id: r.ticket_id,
        issue_type: r.issue_type,
        issue_category: r.issue_category,
        status: r.status,
        priority: r.priority,
        sla: r.sla,
        disputed_amount: r.disputed_amount,
        created_at: r.created_at,
        assigned_agent: r.assignedUser ? { id: r.assignedUser.id, name: r.assignedUser.name } : null,
        team_lead: r.teamLead ? { id: r.teamLead.id, name: r.teamLead.name } : null,
        customer: r.booking.customer ? {
          id: r.booking.customer.id,
          name: r.booking.customer.name,
          email: r.booking.customer.email,
          phone: r.booking.customer.phone
        } : null,
        vendor: r.booking.vendor ? {
          id: r.booking.vendor.id,
          name: r.booking.vendor.business_name
        } : null,
        booking_id: r.booking_id
      })),
      meta: {
        total,
        page: pageNum,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });

  } catch (error) {
    console.error("Error fetching reports by vendor:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getAgentTaskcount = async (req, res) => {
  try {
    const { assigned_to } = req.params;

    if (!assigned_to) {
      return res.status(400).json({
        success: false,
        message: "assigned_to is required"
      });
    }

    const [assignedCount, activeCount, closedCount, totalCount] = await Promise.all([

      // Total assigned to this agent
      IssueReport.count({
        where: { assigned_to }
      }),

      // Active tasks of this agent
      IssueReport.count({
        where: {
          assigned_to,
          status: "active"
        }
      }),

      // Closed tasks of this agent
      IssueReport.count({
        where: {
          assigned_to,
          status: "closed"
        }
      }),

      // Total tasks of this agent
      IssueReport.count({
        where: { assigned_to }
      })
    ]);

    res.status(200).json({
      success: true,
      message: "assign task fetched successfully",
      data: {
        total: totalCount,
        assigned: assignedCount,
        active: activeCount,
        closed: closedCount
      }
    });

  } catch (error) {
    console.error("Error fetching report stats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
