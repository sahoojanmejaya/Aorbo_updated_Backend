const auditRepo = require("../repositories/audit.repo");
const { getPagination } = require("../utils/pagination");

async function listAuditLogs(query) {
  const {
    page = 1,
    limit = 50,
    tbrId,
    performer,
    action,
    fromDate,
    toDate
  } = query;

  const pagination = getPagination(page, limit);

  const { rows, total } = await auditRepo.list(
    { tbrId, performer, action, fromDate, toDate },
    pagination
  );

  return {
    logs: rows.map(r => ({
      id: r.id,
      actionTime: r.actionTime,
      performer: {
        id: r.performerId,
        name: r.performerName
      },
      tbr: {
        id: r.tbrId,
        name: r.tbrName
      },
      action: r.action,
      reason: r.reason
    })),
    pagination: {
      currentPage: Number(page),
      itemsPerPage: Number(limit),
      totalItems: total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

module.exports = {
  listAuditLogs
};
