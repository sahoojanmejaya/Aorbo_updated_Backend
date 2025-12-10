console.log("Seeder file loaded successfully!");

const { CancellationPolicy } = require("../models");

const defaultPolicies = [
    {
        title: "Flexible Policy",
        description:
            "Most flexible cancellation policy with minimal deductions",
        rules: [
            {
                rule: "Advance Payment (₹999) Non-refundable",
                deduction: 999,
                deduction_type: "fixed",
            },
            {
                rule: "Full Payment - More than 24 hours before trek: Advance (₹999) held, rest refunded",
                deduction: 999,
                deduction_type: "fixed",
            },
            {
                rule: "Full Payment - Within 24 hours (with free cancellation): GST only refund, lose advance + free cancellation fee + platform fee + insurance",
                deduction: 0,
                deduction_type: "percentage",
            },
            {
                rule: "Full Payment - Within 24 hours (without free cancellation): GST only refund, lose advance + platform fee + insurance",
                deduction: 0,
                deduction_type: "percentage",
            },
            {
                rule: "Full Payment - More than 24 hours (with free cancellation): Refund final_amount - free cancellation fee - platform fee - insurance",
                deduction: 0,
                deduction_type: "percentage",
            },
            {
                rule: "Full Payment - More than 24 hours (without free cancellation): Refund final_amount - ₹999 - platform fee - insurance",
                deduction: 999,
                deduction_type: "fixed",
            },
            {
                rule: "Trek already started/completed: No refund",
                deduction: 100,
                deduction_type: "percentage",
            },
        ],
        descriptionPoints: [
            "Advance payment (₹999) is always non-refundable",
            "Full refund minus advance payment if cancelled 24+ hours before (without free cancellation)",
            "With free cancellation: Full refund minus free cancellation fee, platform fee, and insurance if cancelled 24+ hours before",
            "Within 24 hours: Only GST refunded (if applicable), lose advance + fees",
            "No refund for cancellations after trek has started",
            "Refunds processed within 3-5 business days",
        ],
        is_active: true,
        sort_order: 1,
    },
    {
        title: "Standard Policy",
        description: "Standard cancellation policy with time-based deductions",
        rules: [
            {
                rule: "Cancellation 72+ hours (3+ days) before trek",
                deduction: 20,
                deduction_type: "percentage",
            },
            {
                rule: "Cancellation 48-72 hours (2-3 days) before trek",
                deduction: 50,
                deduction_type: "percentage",
            },
            {
                rule: "Cancellation 24-48 hours (1-2 days) before trek",
                deduction: 70,
                deduction_type: "percentage",
            },
            {
                rule: "Cancellation less than 24 hours before trek",
                deduction: 100,
                deduction_type: "percentage",
            },
            {
                rule: "Cancellation after trek start: No refund",
                deduction: 100,
                deduction_type: "percentage",
            },
        ],
        descriptionPoints: [
            "Cancellation must be made in writing",
            "Refunds calculated based on time remaining before trek start",
            "72+ hours before: 20% deduction, 80% refund",
            "48-72 hours before: 50% deduction, 50% refund",
            "24-48 hours before: 70% deduction, 30% refund",
            "Less than 24 hours: 100% deduction, no refund",
            "After trek start: No refund available",
            "Refunds processed within 5-7 business days",
            "Force majeure events may affect cancellation terms",
        ],
        is_active: true,
        sort_order: 2,
    },
];

async function seedCancellationPolicies() {
    try {
        console.log("Seeding cancellation policies...");
        console.log("Total policies to seed:", defaultPolicies.length);

        for (const policyData of defaultPolicies) {
            console.log(`Processing policy: ${policyData.title}`);
            console.log("Policy data:", JSON.stringify(policyData, null, 2));

            const existingPolicy = await CancellationPolicy.findOne({
                where: { title: policyData.title },
            });

            if (!existingPolicy) {
                console.log(`Creating new policy: ${policyData.title}`);
                const createdPolicy = await CancellationPolicy.create(
                    policyData
                );
                console.log(
                    `Successfully created cancellation policy: ${policyData.title} with ID: ${createdPolicy.id}`
                );
            } else {
                console.log(
                    `Cancellation policy already exists: ${policyData.title}`
                );
            }
        }

        // Verify creation
        const allPolicies = await CancellationPolicy.findAll();
        console.log(`Total policies in database: ${allPolicies.length}`);
        allPolicies.forEach((policy) => {
            console.log(`- ${policy.title} (ID: ${policy.id})`);
        });

        console.log("Cancellation policies seeding completed!");
    } catch (error) {
        console.error("Error seeding cancellation policies:", error);
        console.error("Error details:", error.message);
        if (error.errors) {
            error.errors.forEach((err) => {
                console.error(
                    `Validation error: ${err.message} for field ${err.path}`
                );
            });
        }
        throw error;
    }
}

if (require.main === module) {
    seedCancellationPolicies();
}

module.exports = seedCancellationPolicies;
