/**
 * ============================================================
 * PRODUCTION SCHEMA MAPPING - VENDOR REQUESTS
 * ============================================================
 * 
 * Maps 'batch_cancellation_requests' to the UI's expected format.
 * Includes parsing for 'record_details' to handle Edit Requests.
 * ============================================================
 */

const db = require("../config/db");

async function findPending(limit, offset) {
  try {
    const query = `
      SELECT 
        bcr.id,
        bcr.status,
        bcr.requested_at,
        bcr.batch_id as tbrId,
        bcr.reason,
        COALESCE(bcr.record_details, '{}') as recordDetails,
        
        t.title as serviceName,
        t.id as trekId,
        t.city_ids as cityIds,
        
        v.id as vendorId,
        v.business_name as vendorName,
        
        d.name as destinationName,
        
        (
            SELECT GROUP_CONCAT(DISTINCT COALESCE(c.city_name, ts.stage_name) SEPARATOR ', ')
            FROM trek_stages ts
            LEFT JOIN cities c ON c.id = ts.city_id
            WHERE ts.trek_id = t.id AND ts.is_boarding_point = 1
              AND (ts.batch_id = b.id OR ts.batch_id IS NULL)
        ) as stageCities,
        
        b.start_date as departureTime

      FROM batch_cancellation_requests bcr
      JOIN batches b ON b.id = bcr.batch_id
      JOIN treks t ON t.id = b.trek_id
      JOIN vendors v ON v.id = bcr.vendor_id
      LEFT JOIN destinations d ON d.id = t.destination_id
      WHERE bcr.status = 'pending'
      ORDER BY bcr.requested_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await db.query(query, [limit, offset]);

    // Fetch all cities for fallback resolution
    const [allCities] = await db.query("SELECT id, city_name FROM cities");
    const cityMap = allCities.reduce((acc, c) => ({ ...acc, [c.id]: c.city_name }), {});

    // Post-process to match UI type
    const mappedRows = rows.map(r => {
      let details = {};
      try {
        details = typeof r.recordDetails === 'string' ? JSON.parse(r.recordDetails) : r.recordDetails;
      } catch (e) {
        details = {};
      }

      // Resolve Source Cities
      let sourceCities = [];
      if (r.stageCities) {
        sourceCities = r.stageCities.split(', ');
      } else {
        // Fallback to city_ids
        try {
          const ids = typeof r.cityIds === 'string' ? JSON.parse(r.cityIds) : r.cityIds;
          if (Array.isArray(ids)) {
            sourceCities = ids.map(id => cityMap[id]).filter(Boolean);
          }
        } catch (e) { }
      }
      if (sourceCities.length === 0) sourceCities = ['Various'];

      // Determine Type
      let type = 'Batch Cancellation'; // Default
      if (r.reason && r.reason.toUpperCase().includes('[EDIT]')) {
        type = 'Edit Details';
      } else if (details.accommodationChange || details.captainChange) {
        type = 'Edit Details';
      }

      return {
        id: `REQ-${r.id}`,
        type: type,
        tbrId: `TBR-${r.tbrId}`,
        trekStatus: 'Upcoming',
        vendor: {
          id: r.vendorId,
          name: r.vendorName,
          score: 4.8
        },
        requestedAt: new Date(r.requested_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true }),
        serviceName: r.serviceName,
        sourceCities: sourceCities,
        destinations: [r.destinationName || 'Unknown'],
        schedule: {
          departure: new Date(r.departureTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true })
        },
        details: {
          ...details,
          cancellationReason: r.reason
        },
        actionStatus: null
      };
    });

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM batch_cancellation_requests WHERE status = 'pending'`
    );

    return { rows: mappedRows, total };
  } catch (err) {
    console.error('Error fetching pending requests:', err);
    return { rows: [], total: 0 };
  }
}

async function findHistory(limit, offset) {
  try {
    const query = `
      SELECT 
        bcr.id,
        'BATCH_CANCELLATION' as type,
        bcr.status as status,
        DATE_FORMAT(bcr.processed_at, '%b %d, %Y') as requestDate,
        DATE_FORMAT(bcr.processed_at, '%h:%i %p') as requestTime,
        bcr.batch_id as tbrId,
        CONCAT('TBR-', bcr.batch_id) as tbrDisplayId,
        t.title as serviceName,
        'Trek' as serviceCategory,
        v.business_name as vendorName,
        v.id as vendorId,
        bcr.admin_response as resolutionNotes,
        bcr.processed_by as adminId
      FROM batch_cancellation_requests bcr
      JOIN batches b ON b.id = bcr.batch_id
      JOIN treks t ON t.id = b.trek_id
      JOIN vendors v ON v.id = bcr.vendor_id
      WHERE bcr.status IN ('approved', 'rejected')
      ORDER BY bcr.processed_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await db.query(query, [limit, offset]);

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM batch_cancellation_requests WHERE status IN ('approved', 'rejected')`
    );

    return { rows, total };
  } catch (err) {
    console.error('Error fetching history requests:', err);
    return { rows: [], total: 0 };
  }
}

async function findById(id, conn = null) {
  const dbId = id.toString().replace('REQ-', '');
  const queryExecutor = conn || db;
  const [rows] = await queryExecutor.query(`SELECT * FROM batch_cancellation_requests WHERE id = ?`, [dbId]);
  return rows[0];
}

async function markApproved(id, pid, pname, conn = null) {
  // Strip 'REQ-' prefix if present
  const dbId = id.toString().replace('REQ-', '');
  const queryExecutor = conn || db;

  // 1. Get the Request to find the Batch ID
  const [reqRows] = await queryExecutor.query(`SELECT batch_id FROM batch_cancellation_requests WHERE id = ?`, [dbId]);
  if (!reqRows.length) return;
  const batchId = reqRows[0].batch_id;

  // 2. Update Request Status
  await queryExecutor.query(`UPDATE batch_cancellation_requests SET status='APPROVED', processed_by=?, processed_at=NOW(), admin_response='Approved' WHERE id=?`, [pname, dbId]);

  // 3. Update Batch Status
  await queryExecutor.query(`UPDATE batches SET status='CANCELLED' WHERE id=?`, [batchId]);

  // 4. Update Linked Bookings
  await queryExecutor.query(`UPDATE bookings SET status='cancelled', cancelled_by='vendor', cancellation_reason='Batch Cancelled by Vendor' WHERE batch_id=? AND status != 'cancelled'`, [batchId]);
}

async function markRejected(id, pid, pname, reason, conn = null) {
  const dbId = id.toString().replace('REQ-', '');
  const queryExecutor = conn || db;
  await queryExecutor.query(`UPDATE batch_cancellation_requests SET status='REJECTED', processed_by=?, processed_at=NOW(), admin_response=? WHERE id=?`, [pname, reason, dbId]);
}

module.exports = {
  findPending,
  findHistory,
  findById,
  markApproved,
  markRejected
};
