const disputeRepo = require("../repositories/dispute.repo");
const auditRepo = require("../repositories/audit.repo");

/**
 * --------------------------------------------------
 * CREATE DISPUTE
 * --------------------------------------------------
 */
async function createDispute(payload) {
  const {
    tbrId,
    bookingId,
    type,
    reason,
    raisedById,
    raisedByName
  } = payload;

  if (
    !tbrId ||
    !bookingId ||
    !type ||
    !reason ||
    !raisedById ||
    !raisedByName
  ) {
    throw {
      statusCode: 400,
      message: "Validation failed",
      errors: {
        fields: "Missing required fields"
      }
    };
  }

  return disputeRepo.create({
    tbrId,
    bookingId,
    type,
    reason,
    raisedById,
    raisedByName
  });
}

/**
 * --------------------------------------------------
 * RESOLVE DISPUTE
 * --------------------------------------------------
 */
async function resolveDispute(disputeId, payload) {
  const {
    resolution,
    actionTaken,
    performedById,
    performedByName
  } = payload;

  if (!resolution || !actionTaken || !performedById || !performedByName) {
    throw {
      statusCode: 400,
      message: "Validation failed",
      errors: {
        fields: "Missing resolution details"
      }
    };
  }

  const dispute = await disputeRepo.findById(disputeId);
  if (!dispute) {
    throw {
      statusCode: 404,
      message: "Dispute not found",
      errors: { disputeId }
    };
  }

  if (dispute.status === "RESOLVED") {
    throw {
      statusCode: 409,
      message: "Dispute already resolved",
      errors: { disputeId }
    };
  }

  await disputeRepo.resolve(disputeId, {
    resolution,
    actionTaken
  });

  // 🔐 Audit trail (important)
  await auditRepo.create({
    performerId: performedById,
    performerName: performedByName,
    tbrId: dispute.tbr_id,
    action: "DISPUTE RESOLVED",
    reason: resolution
  });

  return {
    id: disputeId,
    status: "RESOLVED",
    resolution,
    actionTaken
  };
}

module.exports = {
  createDispute,
  resolveDispute   // ✅ THIS WAS MISSING
};
