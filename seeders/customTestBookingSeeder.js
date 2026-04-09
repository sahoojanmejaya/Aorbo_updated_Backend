const {
    Booking,
    BookingTraveler,
    Customer,
    Trek,
    Vendor,
    Batch,
    Traveler,
    CancellationPolicy,
} = require("../models");

const seedCustomBookings = async () => {
    try {
        console.log("🌟 Seeding custom demo bookings for testing...");

        // Fetch required data
        const customer = await Customer.findOne();
        if (!customer) throw new Error("No customer found");

        const travelers = await Traveler.findAll({
            where: { customer_id: customer.id },
            limit: 2
        });
        if (travelers.length === 0) throw new Error("No travelers found for customer");

        // Fetch Treks
        const treks = await Trek.findAll({
            include: [
                { model: Vendor, as: 'vendor' },
                { model: CancellationPolicy, as: 'cancellationPolicy' }
            ],
            limit: 4 // Get a few treks to work with
        });
        if (treks.length === 0) throw new Error("No treks found");

        console.log(`Found ${treks.length} treks to seed bookings for...`);

        // Get batches (ongoing and future)
        const batches = await Batch.findAll();
        const ongoingBatches = batches.filter(b => new Date(b.start_date) <= new Date() && new Date(b.end_date) >= new Date());
        const futureBatches = batches.filter(b => new Date(b.start_date) > new Date());
        
        const bookingsToCreate = [];
        const bookingTravelersToCreate = [];

        for (const trek of treks) {
            console.log(`Processing trek: ${trek.title}`);
            const policyType = trek.cancellationPolicy ? trek.cancellationPolicy.policy_type : 'standard';
            console.log(`Policy type: ${policyType}`);

            const trekBatches = batches.filter(b => b.trek_id === trek.id);
            let targetBatch = null;

            // Seed 5 bookings per trek
            for (let i = 0; i < 5; i++) {
                // Alternate between ongoing and future batches if available
                if (i % 2 === 0 && ongoingBatches.length > 0) {
                    targetBatch = ongoingBatches.find(b => b.trek_id === trek.id) || trekBatches[0];
                } else if (futureBatches.length > 0) {
                    targetBatch = futureBatches.find(b => b.trek_id === trek.id) || trekBatches[0];
                } else {
                    targetBatch = trekBatches[0];
                }

                if (!targetBatch) continue;

                const basePrice = parseFloat(trek.base_price || 0);
                const discountAmount = parseFloat(trek.discount_value || 0);
                const finalAmount = basePrice - discountAmount;
                const totalAmount = basePrice * travelers.length;
                const totalDiscount = discountAmount * travelers.length;
                const totalFinalAmount = finalAmount * travelers.length;
                
                // Alternate payment status
                const paymentStatus = i % 2 === 0 ? "completed" : "partial";
                const advanceAmount = paymentStatus === "partial" ? totalFinalAmount * 0.2 : totalFinalAmount;
                const remainAmount = totalFinalAmount - advanceAmount;

                // Alternate booking status
                let status = "confirmed";
                if (i === 3) status = "pending";
                if (i === 4) status = "cancelled";

                const booking = await Booking.create({
                    customer_id: customer.id,
                    trek_id: trek.id,
                    vendor_id: trek.vendor_id,
                    batch_id: targetBatch.id,
                    coupon_id: null,
                    total_travelers: travelers.length,
                    total_amount: totalAmount,
                    discount_amount: totalDiscount,
                    final_amount: totalFinalAmount,
                    advance_amount: advanceAmount,
                    remaining_amount: remainAmount,
                    payment_status: paymentStatus,
                    status: status,
                    booking_date: new Date(Date.now() - Math.random() * 10000000000), // Random past date
                    special_requests: `Test booking ${i + 1} for ${policyType} policy (${targetBatch.start_date < new Date() ? 'Ongoing' : 'Future'})`,
                    booking_source: "mobile", // As requested by user
                    primary_contact_traveler_id: travelers[0].id,
                    platform_fees: totalFinalAmount * 0.05,
                    gst_amount: totalFinalAmount * 0.05,
                    insurance_amount: 0,
                    free_cancellation_amount: policyType === 'flexible' ? 500 : 0
                });

                bookingsToCreate.push(booking);

                for (const traveler of travelers) {
                    bookingTravelersToCreate.push({
                        booking_id: booking.id,
                        traveler_id: traveler.id,
                        is_primary: traveler.id === travelers[0].id,
                        special_requirements: "Test requirements",
                        accommodation_preference: "shared",
                        meal_preference: "veg",
                        status: status === "cancelled" ? "cancelled" : "confirmed",
                    });
                }
            }
        }

        console.log(`Created ${bookingsToCreate.length} bookings.`);
        
        await BookingTraveler.bulkCreate(bookingTravelersToCreate);
        console.log(`Created ${bookingTravelersToCreate.length} booking travelers.`);

        console.log("✅ Custom booking seeding completed successfully!");
        
        // Recalculate batch slots
        const { recalculateBatchSlots } = require("../utils/batchSlotManager");
        const uniqueBatchIds = [...new Set(bookingsToCreate.map(b => b.batch_id))];
        for (const batchId of uniqueBatchIds) {
            await recalculateBatchSlots(batchId);
        }
        console.log("✅ Batch slots recalculated.");

    } catch (error) {
        console.error("❌ Error seeding custom bookings:", error);
        throw error;
    }
};

if (require.main === module) {
    seedCustomBookings().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { seedCustomBookings };
