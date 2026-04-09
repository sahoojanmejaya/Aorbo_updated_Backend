const db = require('../config/db');

async function create(paymentData) {
    const {
        booking_id,
        payment_type,
        amount,
        claimed_amount,
        accepted_amount,
        method,
        txn_id,
        ref_no,
        attachment_url,
        proof_hash,
        settlement_status,
        vendor_user_id,
        marked_at,
        evidence_status
    } = paymentData;

    const query = `
    INSERT INTO booking_payments (
      booking_id, payment_type, amount, claimed_amount, accepted_amount,
      method, txn_id, ref_no, attachment_url, proof_hash,
      settlement_status, vendor_user_id, marked_at, evidence_status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `;

    const values = [
        booking_id,
        payment_type,
        amount,
        claimed_amount,
        accepted_amount,
        method,
        txn_id,
        ref_no,
        attachment_url,
        proof_hash,
        settlement_status || 'pending',
        vendor_user_id,
        marked_at,
        evidence_status || 'pending'
    ];

    const [result] = await db.query(query, values);
    return result.insertId;
}

async function findByBookingId(bookingId) {
    const query = `SELECT * FROM booking_payments WHERE booking_id = ? ORDER BY created_at DESC`;
    const [rows] = await db.query(query, [bookingId]);
    return rows;
}

module.exports = {
    create,
    findByBookingId
};
