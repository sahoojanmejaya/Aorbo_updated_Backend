"use strict";

/**
 * Test Bookings Seeder
 * Seeds comprehensive test bookings across Flexible and Standard refund policy treks
 * covering ongoing + future batches with varied statuses, payment states, and fee breakdowns.
 *
 * Run with: node seeders/testBookingsSeeder.js
 */

const {
    Booking,
    BookingTraveler,
    Customer,
    Trek,
    Vendor,
    Batch,
    Traveler,
    CancellationPolicy,
    sequelize,
} = require("../models");
const { Op } = require("sequelize");
const { recalculateBatchSlots } = require("../utils/batchSlotManager");

// ─── Helpers ────────────────────────────────────────────────────────────────

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Build a complete fare breakdown from a base_price per person.
 * All fees are embedded in final_amount (what the customer pays in total).
 *
 *   final_amount = total_basic + platform_fees + gst_amount
 *                + insurance_amount + free_cancellation_amount
 */
function buildFareBreakdown(basePrice, numTravelers, opts = {}) {
    const { withInsurance = false, withFreeCancellation = false } = opts;

    const total_basic = round2(basePrice * numTravelers);
    const platform_fees = round2(total_basic * 0.02);          // 2 % platform fee
    const gst_amount = round2(total_basic * 0.05);             // 5 % GST on base
    const insurance_amount = withInsurance ? round2(50 * numTravelers) : 0;
    const free_cancellation_amount = withFreeCancellation ? round2(99 * numTravelers) : 0;

    const final_amount = round2(
        total_basic + platform_fees + gst_amount + insurance_amount + free_cancellation_amount
    );

    return {
        total_amount: total_basic,          // raw booking price before extras
        discount_amount: 0,
        final_amount,                        // grand total the customer pays
        platform_fees,
        gst_amount,
        insurance_amount,
        free_cancellation_amount,
    };
}

/**
 * Build advance/remaining amounts depending on policy and payment state.
 *   Flexible: fixed ₹999 advance
 *   Standard: 20 % of final_amount
 */
function buildPaymentBreakdown(policyType, fareBreakdown, paymentStatus) {
    const { final_amount } = fareBreakdown;

    let advance_amount = 0;
    let remaining_amount = 0;

    if (policyType === "flexible") {
        advance_amount = 999;
    } else {
        advance_amount = round2(final_amount * 0.20);
    }

    if (paymentStatus === "partial" || paymentStatus === "advance_only") {
        remaining_amount = round2(final_amount - advance_amount);
    } else if (paymentStatus === "completed" || paymentStatus === "full_paid") {
        remaining_amount = 0;
    } else {
        // pending – nothing paid yet
        advance_amount = 0;
        remaining_amount = final_amount;
    }

    return { advance_amount, remaining_amount };
}

// Date helpers
const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split("T")[0];
};
const daysFromNow = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().split("T")[0];
};

// TBR-style id for batches created by seeder
const makeTbrId = () => {
    const ts = Date.now().toString().slice(-2);
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let r = "";
    for (let i = 0; i < 5; i++) r += chars[Math.floor(Math.random() * chars.length)];
    return `TBR${ts}${r}`;
};

// ─── Booking scenario matrix (per trek) ─────────────────────────────────────
// 5 bookings per trek:
//  idx | batchType | numTrav | payStatus   | bookStatus  | withIns | withFreeCan
// ─────────────────────────────────────────────────────────────────────────────
const SCENARIOS = [
    { batchType: "ongoing", numTravelers: 2, paymentStatus: "completed",  bookingStatus: "confirmed", withInsurance: true,  withFreeCancellation: true  },
    { batchType: "future",  numTravelers: 1, paymentStatus: "partial",    bookingStatus: "confirmed", withInsurance: false, withFreeCancellation: false },
    { batchType: "future",  numTravelers: 3, paymentStatus: "pending",    bookingStatus: "pending",   withInsurance: false, withFreeCancellation: false },
    { batchType: "ongoing", numTravelers: 1, paymentStatus: "completed",  bookingStatus: "cancelled", withInsurance: true,  withFreeCancellation: false },
    { batchType: "future",  numTravelers: 2, paymentStatus: "partial",    bookingStatus: "confirmed", withInsurance: false, withFreeCancellation: true  },
];

// ─── Main seeder ─────────────────────────────────────────────────────────────

const seedTestBookings = async () => {
    console.log("\n🚀 ===== TEST BOOKINGS SEEDER STARTED =====\n");

    // ── 1. Find or create a test customer ──────────────────────────────────
    let customer = await Customer.findOne();
    if (!customer) {
        console.error("❌ No customer found in the database. Please run the customer seeder first.");
        process.exit(1);
    }
    console.log(`✅ Using customer: ${customer.name} (ID: ${customer.id})`);

    // ── 2. Ensure we have travelers for this customer ──────────────────────
    let travelers = await Traveler.findAll({
        where: { customer_id: customer.id, is_active: true },
    });

    const travelerNames = [
        { name: "Test Traveler Alpha",   age: 28, gender: "male"   },
        { name: "Test Traveler Beta",    age: 25, gender: "female" },
        { name: "Test Traveler Gamma",   age: 32, gender: "male"   },
    ];

    for (const td of travelerNames) {
        const exists = travelers.find((t) => t.name === td.name);
        if (!exists) {
            const t = await Traveler.create({ customer_id: customer.id, ...td });
            travelers.push(t);
            console.log(`   ➕ Created traveler: ${t.name} (ID: ${t.id})`);
        }
    }
    console.log(`✅ Travelers ready: ${travelers.length} total\n`);

    // ── 3. Fetch Flexible and Standard policies ────────────────────────────
    const flexiblePolicy = await CancellationPolicy.findOne({
        where: { title: { [Op.like]: "%Flexible%" } },
    });
    const standardPolicy = await CancellationPolicy.findOne({
        where: { title: { [Op.like]: "%Standard%" } },
    });

    if (!flexiblePolicy || !standardPolicy) {
        console.error(
            "❌ CancellationPolicy rows not found. Run: node seeders/cancellationPolicies.js first."
        );
        process.exit(1);
    }
    console.log(`✅ Flexible policy ID: ${flexiblePolicy.id}`);
    console.log(`✅ Standard policy  ID: ${standardPolicy.id}\n`);

    // ── 4. Fetch 2 flexible treks + 2 standard treks ───────────────────────
    let flexTreks = await Trek.findAll({
        where: { cancellation_policy_id: flexiblePolicy.id, status: "active" },
        include: [{ model: Vendor, as: "vendor" }],
        limit: 2,
    });
    let stdTreks = await Trek.findAll({
        where: { cancellation_policy_id: standardPolicy.id, status: "active" },
        include: [{ model: Vendor, as: "vendor" }],
        limit: 2,
    });

    // Fallback: grab any active treks and assign policies
    if (flexTreks.length + stdTreks.length < 4) {
        console.warn("⚠️  Not enough policy-tagged treks found. Using any active treks and assigning policies.");
        const anyTreks = await Trek.findAll({
            where: { status: "active" },
            include: [{ model: Vendor, as: "vendor" }],
            limit: 4,
        });
        if (anyTreks.length < 4) {
            console.error(`❌ Only ${anyTreks.length} active trek(s) found. Need at least 4 to run this seeder.`);
            process.exit(1);
        }
        // Assign policies to first 2 / last 2
        for (const t of anyTreks.slice(0, 2)) {
            await t.update({ cancellation_policy_id: flexiblePolicy.id });
            t.cancellation_policy_id = flexiblePolicy.id;
        }
        for (const t of anyTreks.slice(2, 4)) {
            await t.update({ cancellation_policy_id: standardPolicy.id });
            t.cancellation_policy_id = standardPolicy.id;
        }
        flexTreks = anyTreks.slice(0, 2);
        stdTreks  = anyTreks.slice(2, 4);
        console.log("   ✅ Policies assigned to treks.\n");
    }

    const trekGroups = [
        { policyType: "flexible", treks: flexTreks },
        { policyType: "standard", treks: stdTreks },
    ];

    const affectedBatchIds = new Set();
    let totalBookingsCreated = 0;

    // ── 5. For each trek, ensure ongoing + future batches exist ───────────
    for (const { policyType, treks } of trekGroups) {
        for (const trek of treks) {
            console.log(`\n📋 Trek: "${trek.title}" (ID: ${trek.id}) — Policy: ${policyType.toUpperCase()}`);

            const vendor = trek.vendor;
            if (!vendor) {
                console.warn(`   ⚠️  No vendor for trek ${trek.id}, skipping.`);
                continue;
            }

            // Find or create an ongoing batch (start in past, end in future)
            let ongoingBatch = await Batch.findOne({
                where: {
                    trek_id: trek.id,
                    start_date: { [Op.lte]: new Date() },
                    end_date:   { [Op.gte]: new Date() },
                },
            });
            if (!ongoingBatch) {
                ongoingBatch = await Batch.create({
                    tbr_id:          makeTbrId(),
                    trek_id:         trek.id,
                    start_date:      daysAgo(5),
                    end_date:        daysFromNow(3),
                    capacity:        20,
                    booked_slots:    0,
                    available_slots: 20,
                });
                console.log(`   ➕ Created ongoing batch (ID: ${ongoingBatch.id})`);
            } else {
                console.log(`   ♻️  Reusing ongoing batch (ID: ${ongoingBatch.id})`);
            }

            // Find or create a future batch (start in future)
            let futureBatch = await Batch.findOne({
                where: {
                    trek_id:    trek.id,
                    start_date: { [Op.gt]: new Date() },
                },
            });
            if (!futureBatch) {
                futureBatch = await Batch.create({
                    tbr_id:          makeTbrId(),
                    trek_id:         trek.id,
                    start_date:      daysFromNow(30),
                    end_date:        daysFromNow(37),
                    capacity:        20,
                    booked_slots:    0,
                    available_slots: 20,
                });
                console.log(`   ➕ Created future batch (ID: ${futureBatch.id})`);
            } else {
                console.log(`   ♻️  Reusing future batch (ID: ${futureBatch.id})`);
            }

            const batchMap = { ongoing: ongoingBatch, future: futureBatch };
            const basePrice = parseFloat(trek.base_price || 5000);

            // ── 6. Seed 5 bookings for this trek ──────────────────────────
            for (let i = 0; i < SCENARIOS.length; i++) {
                const sc = SCENARIOS[i];
                const batch = batchMap[sc.batchType];

                const fare = buildFareBreakdown(basePrice, sc.numTravelers, {
                    withInsurance:       sc.withInsurance,
                    withFreeCancellation: sc.withFreeCancellation,
                });
                const payment = buildPaymentBreakdown(policyType, fare, sc.paymentStatus);

                // Pick travelers (cycle through available pool)
                const pickedTravelers = travelers.slice(0, sc.numTravelers);

                const booking = await Booking.create({
                    customer_id:              customer.id,
                    trek_id:                  trek.id,
                    vendor_id:                vendor.id,
                    batch_id:                 batch.id,
                    total_travelers:          sc.numTravelers,
                    total_amount:             fare.total_amount,
                    discount_amount:          fare.discount_amount,
                    final_amount:             fare.final_amount,
                    platform_fees:            fare.platform_fees,
                    gst_amount:               fare.gst_amount,
                    insurance_amount:         fare.insurance_amount,
                    free_cancellation_amount: fare.free_cancellation_amount,
                    advance_amount:           payment.advance_amount,
                    remaining_amount:         payment.remaining_amount,
                    payment_status:           sc.paymentStatus,
                    status:                   sc.bookingStatus,
                    booking_source:           "mobile",
                    cancellation_policy_type: policyType,
                    booking_date:             new Date(),
                    special_requests:         `Test booking #${i + 1} for ${policyType} policy scenario`,
                    ...(sc.bookingStatus === "cancelled" && {
                        cancelled_by: "customer",
                        deduction_amount: round2(fare.final_amount * 0.2),
                        refund_amount:    round2(fare.final_amount * 0.8),
                        cancellation_rule: "Test cancellation - standard deduction applied",
                    }),
                });

                // Create BookingTraveler records
                for (let j = 0; j < pickedTravelers.length; j++) {
                    await BookingTraveler.create({
                        booking_id:               booking.id,
                        traveler_id:              pickedTravelers[j].id,
                        is_primary:               j === 0,
                        accommodation_preference: j === 0 ? "shared" : "any",
                        meal_preference:          j % 2 === 0 ? "veg" : "non_veg",
                        status:                   sc.bookingStatus === "cancelled" ? "cancelled" : "confirmed",
                        special_requirements:     `Scenario ${i + 1}, traveler ${j + 1}`,
                    });
                }

                affectedBatchIds.add(batch.id);
                totalBookingsCreated++;

                console.log(
                    `   ✅ Booking #${booking.id} | batch:${sc.batchType}(${batch.id}) ` +
                    `| travelers:${sc.numTravelers} | pay:${sc.paymentStatus} ` +
                    `| status:${sc.bookingStatus} | final:₹${fare.final_amount}`
                );
            }
        }
    }

    // ── 7. Recalculate batch slots for all touched batches ─────────────────
    console.log("\n🔄 Recalculating batch slots...");
    for (const batchId of affectedBatchIds) {
        await recalculateBatchSlots(batchId);
        const updated = await Batch.findByPk(batchId);
        console.log(
            `   ✅ Batch ${batchId}: booked_slots=${updated.booked_slots}, available_slots=${updated.available_slots}`
        );
    }

    console.log(`\n🎉 Seeder complete!`);
    console.log(`   Total bookings created : ${totalBookingsCreated}`);
    console.log(`   Batches recalculated   : ${affectedBatchIds.size}`);
    console.log("\n✅ ===== TEST BOOKINGS SEEDER FINISHED =====\n");
};

// ─── Entry point ─────────────────────────────────────────────────────────────

if (require.main === module) {
    seedTestBookings()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error("❌ Seeder failed:", err);
            process.exit(1);
        });
}

module.exports = { seedTestBookings };
