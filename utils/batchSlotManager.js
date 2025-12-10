const { Batch, Booking } = require("../models");
const { Op } = require("sequelize");

/**
 * Update batch slots when a booking is created
 * @param {number} batchId - The batch ID
 * @param {number} numberOfTravelers - Number of travelers in the booking
 * @param {string} transaction - Database transaction
 */
const updateBatchSlotsOnBooking = async (
    batchId,
    numberOfTravelers,
    transaction = null
) => {
    try {
        const batch = await Batch.findByPk(batchId, { transaction });
        if (!batch) {
            throw new Error(`Batch with ID ${batchId} not found`);
        }

        const newBookedSlots = (batch.booked_slots || 0) + numberOfTravelers;
        const newAvailableSlots = batch.capacity - newBookedSlots;

        if (newAvailableSlots < 0) {
            throw new Error(`Not enough slots available in batch ${batchId}`);
        }

        await batch.update(
            {
                booked_slots: newBookedSlots,
                available_slots: newAvailableSlots,
            },
            { transaction }
        );

        return {
            bookedSlots: newBookedSlots,
            availableSlots: newAvailableSlots,
        };
    } catch (error) {
        console.error("Error updating batch slots on booking:", error);
        throw error;
    }
};

/**
 * Update batch slots when a booking is cancelled
 * @param {number} batchId - The batch ID
 * @param {number} numberOfTravelers - Number of travelers in the cancelled booking
 * @param {string} transaction - Database transaction
 */
const updateBatchSlotsOnCancellation = async (
    batchId,
    numberOfTravelers,
    transaction = null
) => {
    try {
        const batch = await Batch.findByPk(batchId, { transaction });
        if (!batch) {
            throw new Error(`Batch with ID ${batchId} not found`);
        }

        const newBookedSlots = Math.max(
            0,
            (batch.booked_slots || 0) - numberOfTravelers
        );
        const newAvailableSlots = batch.capacity - newBookedSlots;

        await batch.update(
            {
                booked_slots: newBookedSlots,
                available_slots: newAvailableSlots,
            },
            { transaction }
        );

        return {
            bookedSlots: newBookedSlots,
            availableSlots: newAvailableSlots,
        };
    } catch (error) {
        console.error("Error updating batch slots on cancellation:", error);
        throw error;
    }
};

/**
 * Recalculate batch slots based on actual bookings
 * @param {number} batchId - The batch ID
 * @param {string} transaction - Database transaction
 */
const recalculateBatchSlots = async (batchId, transaction = null) => {
    try {
        const batch = await Batch.findByPk(batchId, { transaction });
        if (!batch) {
            throw new Error(`Batch with ID ${batchId} not found`);
        }

        // Count confirmed and pending bookings for this batch
        const bookedCount = await Booking.count({
            where: {
                batch_id: batchId,
                status: { [Op.in]: ["confirmed", "pending"] },
            },
            transaction,
        });

        const newAvailableSlots = batch.capacity - bookedCount;

        await batch.update(
            {
                booked_slots: bookedCount,
                available_slots: newAvailableSlots,
            },
            { transaction }
        );

        return {
            bookedSlots: bookedCount,
            availableSlots: newAvailableSlots,
        };
    } catch (error) {
        console.error("Error recalculating batch slots:", error);
        throw error;
    }
};

/**
 * Initialize batch slots for all batches (useful for migration)
 */
const initializeAllBatchSlots = async () => {
    try {
        const batches = await Batch.findAll();

        for (const batch of batches) {
            await recalculateBatchSlots(batch.id);
        }

        console.log(`Initialized slots for ${batches.length} batches`);
    } catch (error) {
        console.error("Error initializing batch slots:", error);
        throw error;
    }
};

module.exports = {
    updateBatchSlotsOnBooking,
    updateBatchSlotsOnCancellation,
    recalculateBatchSlots,
    initializeAllBatchSlots,
};
