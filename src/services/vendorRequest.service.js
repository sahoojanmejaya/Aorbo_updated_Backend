const repo = require("../repositories/vendorRequest.repo");
const db = require("../config/db");
const { buildPaginationMeta, getPagination } = require("../utils/pagination");

/**
 * --------------------------------------------------
 * GET ALL VENDOR REQUESTS (PENDING + HISTORY)
 * --------------------------------------------------
 */
async function getAll(query) {
  const { page, limit, offset } = getPagination(query.page, query.limit);
  
  // Get both pending and history
  const pendingResult = await repo.findPending(1000, 0); // Get all pending
  const historyResult = await repo.findHistory(1000, 0); // Get all history
  
  // Combine and sort by date
  const allRequests = [...pendingResult.rows, ...historyResult.rows];
  const total = allRequests.length;
  
  // Apply pagination
  const paginatedRequests = allRequests.slice(offset, offset + limit);
  
  return {
    requests: paginatedRequests,
    pagination: buildPaginationMeta(page, limit, total)
  };
}

/**
 * --------------------------------------------------
 * GET PENDING WITHDRAWAL REQUESTS
 * --------------------------------------------------
 */
async function getPending(query) {
  const { page, limit, offset } = getPagination(query.page, query.limit);
  const { rows, total } = await repo.findPending(limit, offset);

  return {
    requests: rows,
    pagination: buildPaginationMeta(page, limit, total)
  };
}

/**
 * --------------------------------------------------
 * GET WITHDRAWAL REQUEST HISTORY
 * --------------------------------------------------
 */
async function getHistory(query) {
  const { page, limit, offset } = getPagination(query.page, query.limit);
  const { rows, total } = await repo.findHistory(limit, offset);

  return {
    requests: rows,
    pagination: buildPaginationMeta(page, limit, total)
  };
}

/**
 * --------------------------------------------------
 * APPROVE WITHDRAWAL REQUEST
 * --------------------------------------------------
 */
async function approve(requestId, { performerId, performerName }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const req = await repo.findById(requestId, conn);
    if (!req) {
      throw {
        statusCode: 404,
        message: "Withdrawal request not found"
      };
    }

    // Mark approved + create withdrawal
    await repo.markApproved(requestId, performerId, performerName, conn);

    await conn.commit();

    return {
      id: requestId,
      actionStatus: "Approved"
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * --------------------------------------------------
 * REJECT WITHDRAWAL REQUEST
 * --------------------------------------------------
 */
async function reject(requestId, { performerId, performerName, reason }) {
  if (!reason) {
    throw {
      statusCode: 400,
      message: "Validation failed",
      errors: { reason: "Rejection reason is required" }
    };
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const req = await repo.findById(requestId, conn);
    if (!req) {
      throw {
        statusCode: 404,
        message: "Withdrawal request not found"
      };
    }

    await repo.markRejected(requestId, performerId, performerName, reason, conn);

    await conn.commit();

    return {
      id: requestId,
      actionStatus: "Rejected"
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  getAll,
  getPending,
  getHistory,
  approve,
  reject
};
