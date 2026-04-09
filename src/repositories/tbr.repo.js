const db = require("../config/db");

/**
 * ============================================================
 * TBR = BATCHES (FINAL SAFE VERSION)
 * ============================================================
 */

async function findAll(filters = {}, limit = 50, offset = 0) {
  const conditions = [];
  const values = [];

  if (filters.tbrIdSearch) {
    conditions.push("(b.tbr_id LIKE ? OR t.title LIKE ?)");
    values.push(`%${filters.tbrIdSearch}%`, `%${filters.tbrIdSearch}%`);
  }

  if (filters.startDate) {
    conditions.push("b.start_date >= ?");
    values.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push("b.start_date <= ?");
    values.push(filters.endDate);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const dataQuery = `
    SELECT
      b.id,
      b.tbr_id AS tbrId,

      t.id AS trekId,
      t.title AS trekName,
      COALESCE(d.name, '') AS destination,

      COALESCE(
        CASE 
          WHEN MAX(ti.url) LIKE 'http%' THEN MAX(ti.url)
          ELSE CONCAT('http://localhost:5000/', MAX(ti.url))
        END, 
        ''
      ) AS trekImage,

      b.start_date AS departureTime,
      b.end_date AS arrivalTime,

      t.base_price AS originalPrice,
      t.discount_type AS discountType,
      t.discount_value AS discountValue,

      CASE
        WHEN t.has_discount = 1 AND t.discount_type = 'percentage'
          THEN ROUND(t.base_price - (t.base_price * t.discount_value / 100), 2)
        WHEN t.has_discount = 1 AND t.discount_type = 'fixed'
          THEN ROUND(t.base_price - t.discount_value, 2)
        ELSE t.base_price
      END AS discountedPrice,

      CASE 
        WHEN UPPER(COALESCE(cp.title, 'STANDARD')) LIKE '%FLEXIBLE%' THEN 'FLEXIBLE'
        ELSE 'STANDARD'
      END AS cancellationPolicy,
      CASE WHEN b.status = 'cancelled' THEN 1 ELSE 0 END AS isCancelled,
      1 AS isApproved,

      (
        SELECT 'CANCELLATION REQUEST'
        FROM batch_cancellation_requests bcr 
        WHERE bcr.batch_id = b.id AND bcr.status = 'pending'
        LIMIT 1
      ) AS vendorRequestBadge,
      'NONE' AS cancellationRequestStatus,

      GROUP_CONCAT(DISTINCT badge.id) AS badgeIds,

      (
        SELECT COALESCE(c.city_name, ts.stage_name)
        FROM trek_stages ts
        LEFT JOIN cities c ON c.id = ts.city_id
        WHERE ts.trek_id = t.id 
          AND ts.is_boarding_point = 1 
          AND (ts.batch_id = b.id OR ts.batch_id IS NULL)
        ORDER BY ts.batch_id DESC
        LIMIT 1
      ) AS sourceLocation,

      (
        SELECT JSON_OBJECT('id', u.id, 'name', u.name)
        FROM users u
        WHERE u.role_id = 1 -- Assuming role_id 1 is Admin
        ORDER BY u.id ASC
        LIMIT 1
      ) AS approvedBy,

      b.capacity AS totalSlots,
      (SELECT COUNT(*) FROM bookings WHERE batch_id = b.id AND status IN ('confirmed', 'pending')) AS bookedSlots,
      (b.capacity - (SELECT COUNT(*) FROM bookings WHERE batch_id = b.id AND status IN ('confirmed', 'pending'))) AS availableSlots,
      
      JSON_OBJECT(
        'id', tv.id,
        'name', COALESCE(tv.business_name, 'Unknown Operator'),
        'logo', JSON_UNQUOTE(JSON_EXTRACT(tv.company_info, '$.logo')), 
        'credibilityScore', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(tv.company_info, '$.credibility')), 4.5)
      ) AS operator,

      JSON_ARRAY() AS bookings

    FROM batches b
    INNER JOIN treks t ON t.id = b.trek_id
    LEFT JOIN destinations d ON d.id = t.destination_id
    LEFT JOIN vendors tv ON tv.id = t.vendor_id
    LEFT JOIN cancellation_policies cp ON cp.id = t.cancellation_policy_id
    LEFT JOIN trek_images ti
      ON ti.trek_id = t.id AND ti.is_cover = 1
    LEFT JOIN badges badge ON badge.id = t.badge_id

    ${whereClause}
    GROUP BY b.id, b.tbr_id, t.id, t.title, d.name, b.start_date, b.end_date, 
             t.base_price, t.has_discount, t.discount_type, t.discount_value,
             cp.title, tv.id, tv.business_name, b.capacity
    ORDER BY b.start_date DESC
    LIMIT ? OFFSET ?;
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM batches b
    INNER JOIN treks t ON t.id = b.trek_id
    ${whereClause};
  `;

  const [rows] = await db.query(dataQuery, [...values, limit, offset]);
  const [[count]] = await db.query(countQuery, values);

  // Resolution of Badges
  // Collect all badge IDs
  const allBadgeIds = new Set();
  rows.forEach(r => {
    if (r.badgeIds) {
      r.badgeIds.toString().split(',').forEach(id => allBadgeIds.add(id));
    }
  });

  let badgeMap = {};
  if (allBadgeIds.size > 0) {
    const [badgeRows] = await db.query(`SELECT id, name, color, icon FROM badges WHERE id IN (${[...allBadgeIds].join(',')})`);
    badgeRows.forEach(b => { badgeMap[b.id] = b; });
  }

  return {
    rows: rows.map(r => ({
      ...r,
      operator: typeof r.operator === "string" ? JSON.parse(r.operator) : r.operator,
      badges: r.badgeIds ? r.badgeIds.toString().split(',').map(id => badgeMap[id]).filter(Boolean) : [],
      bookings: []
    })),
    total: count.total
  };
}

async function findById(batchId) {
  // Determine if searching by PK (Numeric) or tbr_id (String like 'TBR-%')
  // Note: batchId might be string "390", so check format or regex
  // Determine if searching by PK (Numeric) or tbr_id (String like 'TBR-%' or 'S1-%')
  const isTbrId = isNaN(Number(batchId));
  const whereClause = isTbrId ? 'b.tbr_id = ?' : 'b.id = ?';

  const query = `
    SELECT
      b.id,
      b.tbr_id AS tbrId,

      t.id AS trekId,
      t.title AS trekName,
      COALESCE(d.name, '') AS destination,

      COALESCE(ti.url, '') AS trekImage,

      b.start_date AS departureTime,
      b.end_date AS arrivalTime,

      t.base_price AS originalPrice,
      t.discount_type AS discountType,
      t.discount_value AS discountValue,

      CASE
        WHEN t.has_discount = 1 AND t.discount_type = 'percentage'
          THEN ROUND(t.base_price - (t.base_price * t.discount_value / 100), 2)
        WHEN t.has_discount = 1 AND t.discount_type = 'fixed'
          THEN ROUND(t.base_price - t.discount_value, 2)
        ELSE t.base_price
      END AS discountedPrice,

      CASE 
        WHEN UPPER(COALESCE(cp.title, 'STANDARD')) LIKE '%FLEXIBLE%' THEN 'FLEXIBLE'
        ELSE 'STANDARD'
      END AS cancellationPolicy,
      cp.rules AS cancellationRules,
      CASE WHEN b.status = 'cancelled' THEN 1 ELSE 0 END AS isCancelled,
      1 AS isApproved,

      NULL AS vendorRequestBadge,
      'NONE' AS cancellationRequestStatus,
      'NONE' AS cancellationRequestStatus,
      -- 'BEST SELLER' AS marketingBadge, -- Removed hardcoding

      JSON_OBJECT(
        'id', tv.id,
        'name', tv.business_name,
        'logo', JSON_UNQUOTE(JSON_EXTRACT(tv.company_info, '$.logo')),
        'credibilityScore', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(tv.company_info, '$.credibility')), 4.5)
      ) AS operator,

      b.captain_id,
      t.badge_id,
      t.inclusions,
      t.exclusions,
      t.activities,
      t.trekking_rules,
      t.emergency_protocols,
      t.city_ids

    FROM batches b
    INNER JOIN treks t ON t.id = b.trek_id
    LEFT JOIN destinations d ON d.id = t.destination_id
    LEFT JOIN vendors tv ON tv.id = t.vendor_id
    LEFT JOIN cancellation_policies cp ON cp.id = t.cancellation_policy_id
    LEFT JOIN trek_images ti
      ON ti.trek_id = t.id AND ti.is_cover = 1
    WHERE ${whereClause}
    LIMIT 1;
  `;

  const [rows] = await db.query(query, [batchId]);
  if (!rows.length) return null;

  const tbr = rows[0];

  // 1. Fetch Trek Stages & Boarding Points (with city names) - Filter by batch
  const [stages] = await db.query(
    `SELECT ts.stage_name, ts.destination, ts.means_of_transport, ts.date_time, 
            ts.is_boarding_point, ts.city_id, c.city_name
     FROM trek_stages ts
     LEFT JOIN cities c ON c.id = ts.city_id
     WHERE ts.trek_id = ? 
       AND (ts.batch_id = ? OR ts.batch_id IS NULL)
     ORDER BY ts.id ASC`,
    [tbr.trekId, tbr.id]
  );

  const trekStages = stages.map(s => ({
    stageName: s.stage_name,
    destination: s.destination,
    transport: s.means_of_transport,
    dateTime: s.date_time,
    isBoardingPoint: s.is_boarding_point === 1,
    cityId: s.city_id,
    cityName: s.city_name
  }));

  const boardingPoints = stages
    .filter(s => s.is_boarding_point === 1)
    .map(s => ({
      name: s.stage_name,
      time: s.date_time,
      location: s.destination,
      cityName: s.city_name
    }));

  // 2. Fetch Itinerary (parse JSON activities array)
  const [itineraryRows] = await db.query(
    `SELECT id, activities FROM itinerary_items WHERE trek_id = ? ORDER BY id ASC`,
    [tbr.trekId]
  );

  const itinerary = itineraryRows.map((i, index) => {
    let activitiesList = [];
    try {
      activitiesList = typeof i.activities === 'string'
        ? JSON.parse(i.activities)
        : (i.activities || []);
    } catch (e) {
      activitiesList = i.activities ? [i.activities] : [];
    }

    return {
      id: i.id,
      day: index + 1,
      dayLabel: `Day ${index + 1}`,
      title: `Day ${index + 1} Schedule`,
      activities: Array.isArray(activitiesList) ? activitiesList : [activitiesList]
    };
  });

  // 3. Fetch Accommodations (Unique Types)
  const [accommodationRows] = await db.query(
    `SELECT DISTINCT type FROM accommodations WHERE trek_id = ?`,
    [tbr.trekId]
  );
  const accommodations = accommodationRows.map(a => a.type);

  // 4. Fetch Captain
  let captain = null;
  if (tbr.captain_id) {
    const [capRows] = await db.query(
      `SELECT name, email, phone, status FROM trek_captains WHERE id = ?`,
      [tbr.captain_id]
    );
    if (capRows.length) captain = capRows[0];
  }

  // 4b. Fetch Badges
  let badges = [];
  if (tbr.badge_id) {
    const [badgeRows] = await db.query(`
      SELECT id, name, color, icon
      FROM badges
      WHERE id = ?
    `, [tbr.badge_id]);
    badges = badgeRows;
  }

  // 5. Resolve Inclusions (IDs -> Names)
  let inclusions = [];
  try {
    const incIds = typeof tbr.inclusions === 'string' ? JSON.parse(tbr.inclusions) : tbr.inclusions;
    if (Array.isArray(incIds) && incIds.length > 0) {
      if (typeof incIds[0] === 'string') {
        inclusions = incIds;
      } else {
        const placeholders = incIds.map(() => '?').join(',');
        const [incRows] = await db.query(
          `SELECT name FROM inclusions WHERE id IN (${placeholders})`,
          incIds
        );
        inclusions = incRows.map(r => r.name);
      }
    }
  } catch (e) {
    console.error("Error parsing inclusions:", e.message);
  }

  // 6. Resolve Activities (IDs -> Names & Group by Category)
  let activities = {};
  try {
    const actIds = typeof tbr.activities === 'string' ? JSON.parse(tbr.activities) : tbr.activities;
    if (Array.isArray(actIds) && actIds.length > 0) {
      if (typeof actIds[0] === 'string') {
        activities = { 'Highlights': actIds };
      } else {
        const placeholders = actIds.map(() => '?').join(',');
        const [actRows] = await db.query(
          `SELECT name, category_name FROM activities WHERE id IN (${placeholders})`,
          actIds
        );

        // Group by Category
        activities = actRows.reduce((acc, row) => {
          const cat = row.category_name || 'Other';
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(row.name);
          return acc;
        }, {});
      }
    }
  } catch (e) {
    console.error("Error parsing activities:", e.message);
  }

  // 7. Resolve Exclusions (IDs -> Names or Raw Strings)
  let exclusions = [];
  try {
    const excData = typeof tbr.exclusions === 'string' ? JSON.parse(tbr.exclusions) : tbr.exclusions;
    if (Array.isArray(excData) && excData.length > 0) {
      // Check if it's already an array of strings
      if (typeof excData[0] === 'string') {
        exclusions = excData;
      } else {
        // Assume IDs
        const placeholders = excData.map(() => '?').join(',');
        const [excRows] = await db.query(
          `SELECT name FROM exclusions WHERE id IN (${placeholders})`,
          excData
        );
        exclusions = excRows.map(r => r.name);
      }
    }
  } catch (e) {
    console.error("Error parsing exclusions:", e.message);
  }

  // 8. Fetch Ratings (average rating)
  let rating = null;
  try {
    const [[ratingData]] = await db.query(
      `SELECT 
        AVG(rating_value) as avgRating,
        COUNT(*) as totalRatings
       FROM ratings 
       WHERE trek_id = ? AND is_approved = 1`,
      [tbr.trekId]
    );

    if (ratingData && ratingData.totalRatings > 0) {
      rating = {
        average: parseFloat(ratingData.avgRating).toFixed(1),
        count: ratingData.totalRatings
      };
    }
  } catch (err) {
    console.error("Error fetching ratings:", err.message);
  }

  // 9. Fetch Bookings (Active & Cancelled)
  // 8. Resolve Source Cities (from city_ids JSON)
  let sourceCities = [];
  try {
    const cityIds = typeof tbr.city_ids === 'string' ? JSON.parse(tbr.city_ids) : tbr.city_ids;
    if (Array.isArray(cityIds) && cityIds.length > 0) {
      const placeholders = cityIds.map(() => '?').join(',');
      const [cityRows] = await db.query(
        `SELECT city_name FROM cities WHERE id IN (${placeholders})`,
        cityIds
      );
      sourceCities = cityRows.map(r => r.city_name);
    }
  } catch (e) {
    console.error("Error parsing city_ids:", e.message);
  }

  // Use tbr.id (Integer ID) because booking table uses numeric batch_id FK
  let bookings = [];
  let financeSummary = null;
  try {
    const bookingRepo = require('./booking.repo');
    bookings = await bookingRepo.findByBatchId(tbr.id);
    financeSummary = bookingRepo.calculateFinanceSummary(bookings);
  } catch (err) {
    console.error("Error fetching bookings/finance for TBR:", err.message);
  }

  // 10. Metadata Check
  if (!activities || Object.keys(activities).length === 0) {
    activities = { 'Highlights': [] };
  }

  return {
    ...tbr,
    operator: typeof tbr.operator === "string"
      ? JSON.parse(tbr.operator)
      : tbr.operator,
    bookings,
    financeSummary,

    // Enriched Fields
    trekStages,
    boardingPoints,
    itinerary,
    accommodations, // Now array of strings
    captain,
    badges,         // Now array of objects
    inclusions,
    activities,
    exclusions,
    rating,         // Average rating and count
    otherPolicies: typeof tbr.trekking_rules === 'string'
      ? (tbr.trekking_rules.startsWith('[') ? JSON.parse(tbr.trekking_rules) : tbr.trekking_rules.split('\n').filter(Boolean))
      : (tbr.trekking_rules || []),
    emergencyProtocols: tbr.emergency_protocols,
    sourceCities
  };
}

module.exports = { findAll, findById };
