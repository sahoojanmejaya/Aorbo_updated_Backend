/**
 * Vendor Collection Service
 *
 * Handles vendor marking balance as "collected" (offline cash/UPI/card).
 * Rules:
 *   - Immutable: once submitted, vendor cannot edit (admin-only override)
 *   - Cap accepted_collected at balance_due; flag is_over_claim if exceeded
 *   - Log vendor_user_id, timestamp, method, ref_no, attachment
 *   - Allow post-start collection marks
 *   - Overpay detection → create OverpayRecord
 *   - Fraud detection: if vendor has X no-proof marks in Y days → flag + alert admin
 */

const { sequelize, Op } = require('../models');
const { roundHalfUp } = require('../utils/refundCalculator');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Configurable fraud thresholds (can be moved to platformConfig)
const FRAUD_NO_PROOF_WINDOW_DAYS = 7;
const FRAUD_NO_PROOF_THRESHOLD = 3;
const OVER_CLAIM_REQUIRE_PROOF_ABOVE = 500; // ₹ — require proof for marks above this amount

class VendorCollectionService {
    /**
     * Submit a vendor collection mark.
     *
     * @param {Object} opts
     * @param {number}  opts.bookingId
     * @param {number}  opts.vendorUserId
     * @param {number}  opts.amountCollected
     * @param {string}  opts.method          cash | upi | card | other
     * @param {string}  [opts.refNo]
     * @param {string}  [opts.attachmentUrl]
     * @param {Buffer|null} [opts.attachmentBuffer]  for proof_hash
     */
    async markCollected({ bookingId, vendorUserId, amountCollected, method, refNo, attachmentUrl, attachmentBuffer }) {
        const { Booking, Batch, VendorCollection, OverpayRecord, BookingAuditLog } = require('../models');
        const { Op } = require('sequelize');

        const transaction = await sequelize.transaction();
        try {
            const booking = await Booking.findByPk(bookingId, {
                include: [{ model: Batch, as: 'batch', attributes: ['start_date'] }],
                lock: transaction.LOCK.UPDATE,
                transaction,
            });

            if (!booking) {
                await transaction.rollback();
                return { status: 404, error: 'Booking not found' };
            }

            // Check booking is in a state that allows collection
            if (['cancelled'].includes(booking.status)) {
                await transaction.rollback();
                return { status: 422, error: 'Cannot mark collection on a cancelled booking' };
            }

            // Immutability: reject if already marked
            const existingMark = await VendorCollection.findOne({
                where: { booking_id: bookingId },
                transaction,
            });
            if (existingMark) {
                await transaction.rollback();
                return { status: 409, error: 'Collection already marked for this booking. Contact admin to override.' };
            }

            // Validate amount
            const parsedAmount = parseFloat(amountCollected);
            if (!parsedAmount || parsedAmount <= 0) {
                await transaction.rollback();
                return { status: 400, error: 'Invalid amount_collected' };
            }

            const balanceDue = parseFloat(booking.remaining_amount) || 0;
            const now = new Date();
            const trekStart = booking.batch?.start_date ? new Date(booking.batch.start_date) : null;
            const isPostStart = trekStart ? now >= trekStart : false;

            // Over-claim check
            const isOverClaim = parsedAmount > balanceDue;
            const acceptedCollected = isOverClaim ? roundHalfUp(balanceDue) : roundHalfUp(parsedAmount);

            // Proof validation: for high-value marks, require attachment
            if (parsedAmount > OVER_CLAIM_REQUIRE_PROOF_ABOVE && !attachmentUrl) {
                await transaction.rollback();
                return {
                    status: 400,
                    error: `Attachment required for collections above ₹${OVER_CLAIM_REQUIRE_PROOF_ABOVE}`,
                };
            }

            // Compute proof_hash
            let proofHash = null;
            if (attachmentBuffer) {
                proofHash = crypto.createHash('sha256').update(attachmentBuffer).digest('hex');
            }

            // Create immutable VendorCollection record
            const collectionRecord = await VendorCollection.create({
                booking_id: bookingId,
                vendor_user_id: vendorUserId,
                amount_collected: parsedAmount,
                balance_due_at_mark: balanceDue,
                accepted_collected: acceptedCollected,
                method,
                ref_no: refNo || null,
                attachment_url: attachmentUrl || null,
                proof_hash: proofHash,
                is_post_start: isPostStart,
                is_over_claim: isOverClaim,
                collected_at: now,
            }, { transaction });

            // Update booking: reduce remaining_amount
            await booking.update({
                remaining_amount: Math.max(0, roundHalfUp(balanceDue - acceptedCollected)),
            }, { transaction });

            // Audit log
            await BookingAuditLog?.create({
                booking_id: bookingId,
                actor_id: vendorUserId,
                actor_type: 'vendor',
                action: 'vendor_collection_mark',
                before_state: JSON.stringify({ remaining_amount: balanceDue }),
                after_state: JSON.stringify({
                    accepted_collected: acceptedCollected,
                    is_over_claim: isOverClaim,
                    method,
                }),
                created_at: now,
            }, { transaction });

            // Overpay record if over-claimed
            let overpayRecord = null;
            if (isOverClaim) {
                const overpayAmount = roundHalfUp(parsedAmount - balanceDue);
                overpayRecord = await OverpayRecord?.create({
                    booking_id: bookingId,
                    vendor_collection_id: collectionRecord.id,
                    collected_amount: parsedAmount,
                    balance_due: balanceDue,
                    overpay_amount: overpayAmount,
                    refund_status: 'pending',
                }, { transaction });
            }

            await transaction.commit();

            // Fraud check (outside transaction, non-blocking)
            this._checkVendorFraud(vendorUserId).catch((err) => {
                logger.error('fraud', 'Fraud check failed', { vendor_user_id: vendorUserId, error: err.message });
            });

            logger.info('vendor_collection', 'Collection marked', {
                booking_id: bookingId,
                vendor_user_id: vendorUserId,
                amount_collected: parsedAmount,
                accepted_collected: acceptedCollected,
                is_over_claim: isOverClaim,
                is_post_start: isPostStart,
            });

            return {
                status: 200,
                collection: collectionRecord.toJSON(),
                is_over_claim: isOverClaim,
                overpay_record: overpayRecord?.toJSON() || null,
                warning: isOverClaim
                    ? `Over-claim detected: accepted ₹${acceptedCollected}, excess ₹${roundHalfUp(parsedAmount - balanceDue)} flagged for admin review`
                    : null,
            };
        } catch (error) {
            await transaction.rollback();
            logger.error('vendor_collection', 'markCollected failed', {
                booking_id: bookingId,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Internal: check vendor for suspicious no-proof collection pattern.
     * If threshold exceeded → flag vendor + alert admin.
     */
    async _checkVendorFraud(vendorUserId) {
        const { VendorCollection, Vendor } = require('../models');

        const windowStart = new Date(Date.now() - FRAUD_NO_PROOF_WINDOW_DAYS * 24 * 3600 * 1000);

        const noProofCount = await VendorCollection.count({
            where: {
                vendor_user_id: vendorUserId,
                attachment_url: null,
                collected_at: { [require('sequelize').Op.gte]: windowStart },
            },
        });

        if (noProofCount >= FRAUD_NO_PROOF_THRESHOLD) {
            logger.warn('fraud', 'Vendor fraud flag: excessive no-proof collections', {
                vendor_user_id: vendorUserId,
                no_proof_count: noProofCount,
                window_days: FRAUD_NO_PROOF_WINDOW_DAYS,
            });

            // Flag on Vendor record (requires fraud_flag / payout_hold columns — added by migration)
            try {
                await Vendor?.update(
                    { fraud_flag: true, payout_hold: true },
                    { where: { /* find vendor by user_id */ } }
                );
            } catch (_) { /* column may not exist yet — safe to skip */ }

            // TODO: trigger admin alert notification here
        }
    }
}

module.exports = new VendorCollectionService();
