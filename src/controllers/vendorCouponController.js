const pool = require('../config/db');

// Helper: Generate Assignment ID
const generateAssignmentId = () => {
  return `VCA-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

// Helper: Log assignment history
const logAssignmentHistory = async (connection, assignmentId, action, details) => {
  await connection.query(`
    INSERT INTO vendor_coupon_assignment_history 
    (assignment_id, action, previous_status, new_status, previous_tbr, new_tbr, performed_by, reason, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    assignmentId,
    action,
    details.previousStatus || null,
    details.newStatus || null,
    details.previousTbr || null,
    details.newTbr || null,
    details.performedBy || 'System',
    details.reason || null,
    JSON.stringify(details.metadata || {})
  ]);
};

// 1. GET Vendor Coupon Pool - Get available coupons for a vendor
const getVendorCouponPool = async (req, res) => {
  try {
    const { vendorId } = req.params;
    
    const [rows] = await pool.query(`
      SELECT 
        vcp.*,
        c.code as coupon_code,
        c.description as coupon_description,
        c.discount_type,
        c.discount_value,
        c.status as coupon_status
      FROM vendor_coupon_pool vcp
      JOIN coupons c ON vcp.coupon_id = c.id
      WHERE vcp.vendor_id = ? AND vcp.is_active = TRUE
      ORDER BY vcp.assignment_type, vcp.created_at DESC
    `, [vendorId]);
    
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 2. POST Assign Coupon to TBR
const assignCouponToTBR = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      vendorId,
      couponId,
      tbr,
      trekId,
      trekName,
      customerName,
      customerEmail,
      customerPhone,
      assignmentType,
      assignedBy,
      notes
    } = req.body;

    // Validation
    if (!vendorId || !couponId || !tbr || !assignmentType) {
      return res.status(400).json({ 
        error: 'Missing required fields: vendorId, couponId, tbr, assignmentType' 
      });
    }

    await connection.beginTransaction();

    // Check if TBR already has this coupon assigned
    const [existing] = await connection.query(`
      SELECT id, status FROM vendor_coupon_assignments 
      WHERE tbr = ? AND coupon_id = ? AND status NOT IN ('CANCELLED', 'USED', 'REASSIGNED')
    `, [tbr, couponId]);

    if (existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({ 
        error: 'This coupon is already assigned to this TBR',
        existingAssignment: existing[0]
      });
    }

    // Check vendor coupon pool availability
    const [poolCheck] = await connection.query(`
      SELECT available_count FROM vendor_coupon_pool 
      WHERE vendor_id = ? AND coupon_id = ? AND assignment_type = ? AND is_active = TRUE
    `, [vendorId, couponId, assignmentType]);

    if (poolCheck.length === 0) {
      await connection.rollback();
      return res.status(400).json({ 
        error: 'Coupon not available in vendor pool for this assignment type' 
      });
    }

    if (poolCheck[0].available_count <= 0) {
      await connection.rollback();
      return res.status(400).json({ 
        error: 'No available coupons in pool. All allocated coupons have been assigned.' 
      });
    }

    // Create assignment
    const assignmentId = generateAssignmentId();
    
    await connection.query(`
      INSERT INTO vendor_coupon_assignments 
      (id, vendor_id, coupon_id, tbr, trek_id, trek_name, customer_name, customer_email, 
       customer_phone, assignment_type, status, assigned_by, notes, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ASSIGNED', ?, ?, ?)
    `, [
      assignmentId,
      vendorId,
      couponId,
      tbr,
      trekId || null,
      trekName || null,
      customerName || null,
      customerEmail || null,
      customerPhone || null,
      assignmentType,
      assignedBy || 'Vendor',
      notes || null,
      JSON.stringify({ assignedAt: new Date() })
    ]);

    // Update pool counts
    await connection.query(`
      UPDATE vendor_coupon_pool 
      SET total_assigned = total_assigned + 1,
          available_count = available_count - 1
      WHERE vendor_id = ? AND coupon_id = ? AND assignment_type = ?
    `, [vendorId, couponId, assignmentType]);

    // Log history
    await logAssignmentHistory(connection, assignmentId, 'ASSIGNED', {
      newStatus: 'ASSIGNED',
      performedBy: assignedBy || 'Vendor',
      metadata: { tbr, trekId, trekName }
    });

    // Audit log
    await connection.query(`
      INSERT INTO audit_logs (id, timestamp, performer_id, performer_name, action, entity_id, entity_name, details, module)
      VALUES (?, NOW(), ?, ?, 'ASSIGNED', ?, ?, ?, 'VENDOR_COUPON')
    `, [
      `LOG-${Date.now()}`,
      vendorId,
      assignedBy || 'Vendor',
      assignmentId,
      tbr,
      `Coupon assigned to TBR: ${tbr}`
    ]);

    await connection.commit();
    
    res.status(201).json({ 
      message: 'Coupon assigned successfully',
      assignmentId,
      tbr,
      status: 'ASSIGNED'
    });

  } catch (err) {
    await connection.rollback();
    console.error("Assign Coupon Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

// 3. GET Vendor Assignments - Get all assignments for a vendor
const getVendorAssignments = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { status, assignmentType, tbr } = req.query;
    
    let query = `
      SELECT 
        vca.*,
        c.code as coupon_code,
        c.description as coupon_description,
        c.discount_type,
        c.discount_value
      FROM vendor_coupon_assignments vca
      JOIN coupons c ON vca.coupon_id = c.id
      WHERE vca.vendor_id = ?
    `;
    
    const params = [vendorId];
    
    if (status) {
      query += ` AND vca.status = ?`;
      params.push(status);
    }
    
    if (assignmentType) {
      query += ` AND vca.assignment_type = ?`;
      params.push(assignmentType);
    }
    
    if (tbr) {
      query += ` AND vca.tbr = ?`;
      params.push(tbr);
    }
    
    query += ` ORDER BY vca.created_at DESC`;
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 4. GET Assignment by TBR - Check if TBR has assigned coupons
const getAssignmentByTBR = async (req, res) => {
  try {
    const { tbr } = req.params;
    
    const [rows] = await pool.query(`
      SELECT 
        vca.*,
        c.code as coupon_code,
        c.description as coupon_description,
        c.discount_type,
        c.discount_value,
        c.max_discount,
        c.min_order_value,
        v.business_name as vendor_name
      FROM vendor_coupon_assignments vca
      JOIN coupons c ON vca.coupon_id = c.id
      LEFT JOIN vendors v ON vca.vendor_id = v.id
      WHERE vca.tbr = ? AND vca.status IN ('ASSIGNED', 'ACTIVE')
      ORDER BY vca.created_at DESC
    `, [tbr]);
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        message: 'No active coupon assignments found for this TBR' 
      });
    }
    
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 5. PATCH Cancel Assignment (when trek is cancelled)
const cancelAssignment = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { assignmentId } = req.params;
    const { reason, performedBy } = req.body;

    await connection.beginTransaction();

    // Get current assignment
    const [assignment] = await connection.query(`
      SELECT * FROM vendor_coupon_assignments WHERE id = ?
    `, [assignmentId]);

    if (assignment.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const current = assignment[0];

    if (current.status === 'USED') {
      await connection.rollback();
      return res.status(400).json({ 
        error: 'Cannot cancel assignment - coupon has already been used' 
      });
    }

    // Update assignment status
    await connection.query(`
      UPDATE vendor_coupon_assignments 
      SET status = 'CANCELLED', 
          cancelled_at = NOW(),
          cancellation_reason = ?
      WHERE id = ?
    `, [reason || 'Trek cancelled', assignmentId]);

    // Return coupon to pool
    await connection.query(`
      UPDATE vendor_coupon_pool 
      SET total_assigned = total_assigned - 1,
          available_count = available_count + 1
      WHERE vendor_id = ? AND coupon_id = ? AND assignment_type = ?
    `, [current.vendor_id, current.coupon_id, current.assignment_type]);

    // Log history
    await logAssignmentHistory(connection, assignmentId, 'CANCELLED', {
      previousStatus: current.status,
      newStatus: 'CANCELLED',
      performedBy: performedBy || 'System',
      reason: reason || 'Trek cancelled'
    });

    // Audit log
    await connection.query(`
      INSERT INTO audit_logs (id, timestamp, performer_id, performer_name, action, entity_id, entity_name, details, module)
      VALUES (?, NOW(), ?, ?, 'CANCELLED', ?, ?, ?, 'VENDOR_COUPON')
    `, [
      `LOG-${Date.now()}`,
      current.vendor_id,
      performedBy || 'System',
      assignmentId,
      current.tbr,
      `Assignment cancelled: ${reason || 'Trek cancelled'}`
    ]);

    await connection.commit();
    
    res.json({ 
      message: 'Assignment cancelled successfully. Coupon returned to pool.',
      assignmentId,
      status: 'CANCELLED'
    });

  } catch (err) {
    await connection.rollback();
    console.error("Cancel Assignment Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

// 6. PATCH Reassign Coupon to Different TBR
const reassignCoupon = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { assignmentId } = req.params;
    const { newTbr, newTrekId, newTrekName, newCustomerName, reason, performedBy } = req.body;

    if (!newTbr) {
      return res.status(400).json({ error: 'New TBR is required' });
    }

    await connection.beginTransaction();

    // Get current assignment
    const [assignment] = await connection.query(`
      SELECT * FROM vendor_coupon_assignments WHERE id = ?
    `, [assignmentId]);

    if (assignment.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const current = assignment[0];

    if (current.status === 'USED') {
      await connection.rollback();
      return res.status(400).json({ 
        error: 'Cannot reassign - coupon has already been used' 
      });
    }

    // Check if new TBR already has this coupon
    const [existingNew] = await connection.query(`
      SELECT id FROM vendor_coupon_assignments 
      WHERE tbr = ? AND coupon_id = ? AND status NOT IN ('CANCELLED', 'USED', 'REASSIGNED')
    `, [newTbr, current.coupon_id]);

    if (existingNew.length > 0) {
      await connection.rollback();
      return res.status(400).json({ 
        error: 'New TBR already has this coupon assigned' 
      });
    }

    // Update old assignment
    await connection.query(`
      UPDATE vendor_coupon_assignments 
      SET status = 'REASSIGNED'
      WHERE id = ?
    `, [assignmentId]);

    // Create new assignment
    const newAssignmentId = generateAssignmentId();
    
    await connection.query(`
      INSERT INTO vendor_coupon_assignments 
      (id, vendor_id, coupon_id, tbr, trek_id, trek_name, customer_name, customer_email, 
       customer_phone, assignment_type, status, assigned_by, notes, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ASSIGNED', ?, ?, ?)
    `, [
      newAssignmentId,
      current.vendor_id,
      current.coupon_id,
      newTbr,
      newTrekId || null,
      newTrekName || null,
      newCustomerName || null,
      current.customer_email,
      current.customer_phone,
      current.assignment_type,
      performedBy || 'Vendor',
      `Reassigned from TBR: ${current.tbr}. Reason: ${reason || 'Not specified'}`,
      JSON.stringify({ 
        reassignedFrom: assignmentId,
        previousTbr: current.tbr,
        reassignedAt: new Date() 
      })
    ]);

    // Log history for both
    await logAssignmentHistory(connection, assignmentId, 'REASSIGNED', {
      previousStatus: current.status,
      newStatus: 'REASSIGNED',
      previousTbr: current.tbr,
      newTbr: newTbr,
      performedBy: performedBy || 'Vendor',
      reason: reason || 'Reassigned to different TBR'
    });

    await logAssignmentHistory(connection, newAssignmentId, 'ASSIGNED', {
      newStatus: 'ASSIGNED',
      performedBy: performedBy || 'Vendor',
      metadata: { reassignedFrom: assignmentId, previousTbr: current.tbr }
    });

    // Audit log
    await connection.query(`
      INSERT INTO audit_logs (id, timestamp, performer_id, performer_name, action, entity_id, entity_name, details, module)
      VALUES (?, NOW(), ?, ?, 'REASSIGNED', ?, ?, ?, 'VENDOR_COUPON')
    `, [
      `LOG-${Date.now()}`,
      current.vendor_id,
      performedBy || 'Vendor',
      newAssignmentId,
      newTbr,
      `Coupon reassigned from ${current.tbr} to ${newTbr}`
    ]);

    await connection.commit();
    
    res.json({ 
      message: 'Coupon reassigned successfully',
      oldAssignmentId: assignmentId,
      newAssignmentId,
      oldTbr: current.tbr,
      newTbr,
      status: 'ASSIGNED'
    });

  } catch (err) {
    await connection.rollback();
    console.error("Reassign Coupon Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

// 7. POST Allocate Coupons to Vendor Pool
const allocateCouponsToVendor = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      vendorId,
      couponId,
      assignmentType,
      allocatedCount,
      validFrom,
      validUntil,
      performedBy
    } = req.body;

    if (!vendorId || !couponId || !assignmentType || !allocatedCount) {
      return res.status(400).json({ 
        error: 'Missing required fields: vendorId, couponId, assignmentType, allocatedCount' 
      });
    }

    await connection.beginTransaction();

    // Check if pool entry exists
    const [existing] = await connection.query(`
      SELECT id, total_allocated FROM vendor_coupon_pool 
      WHERE vendor_id = ? AND coupon_id = ? AND assignment_type = ?
    `, [vendorId, couponId, assignmentType]);

    if (existing.length > 0) {
      // Update existing pool
      await connection.query(`
        UPDATE vendor_coupon_pool 
        SET total_allocated = total_allocated + ?,
            available_count = available_count + ?,
            valid_from = COALESCE(?, valid_from),
            valid_until = COALESCE(?, valid_until)
        WHERE id = ?
      `, [allocatedCount, allocatedCount, validFrom, validUntil, existing[0].id]);
    } else {
      // Create new pool entry
      await connection.query(`
        INSERT INTO vendor_coupon_pool 
        (vendor_id, coupon_id, assignment_type, total_allocated, available_count, valid_from, valid_until)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [vendorId, couponId, assignmentType, allocatedCount, allocatedCount, validFrom, validUntil]);
    }

    // Audit log
    await connection.query(`
      INSERT INTO audit_logs (id, timestamp, performer_id, performer_name, action, entity_id, entity_name, details, module)
      VALUES (?, NOW(), ?, ?, 'ALLOCATED', ?, ?, ?, 'VENDOR_COUPON')
    `, [
      `LOG-${Date.now()}`,
      vendorId,
      performedBy || 'Admin',
      couponId,
      assignmentType,
      `Allocated ${allocatedCount} coupons to vendor pool`
    ]);

    await connection.commit();
    
    res.status(201).json({ 
      message: 'Coupons allocated to vendor pool successfully',
      vendorId,
      couponId,
      assignmentType,
      allocatedCount
    });

  } catch (err) {
    await connection.rollback();
    console.error("Allocate Coupons Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

// 8. GET Assignment History
const getAssignmentHistory = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    
    const [rows] = await pool.query(`
      SELECT * FROM vendor_coupon_assignment_history 
      WHERE assignment_id = ?
      ORDER BY performed_at DESC
    `, [assignmentId]);
    
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getVendorCouponPool,
  assignCouponToTBR,
  getVendorAssignments,
  getAssignmentByTBR,
  cancelAssignment,
  reassignCoupon,
  allocateCouponsToVendor,
  getAssignmentHistory
};
