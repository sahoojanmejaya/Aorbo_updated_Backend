/**
 * fix-trek-city-ids.js
 *
 * Repairs treks whose city_ids column is empty or null.
 *
 * For each affected trek, the script:
 *   1. Collects all unique city_id values from its TrekStage rows
 *      (boarding points first, then all stages as fallback).
 *   2. Updates trek.city_ids with that array so JSON_CONTAINS queries work.
 *
 * Usage:
 *   node scripts/fix-trek-city-ids.js          # dry-run (no writes)
 *   node scripts/fix-trek-city-ids.js --apply  # apply changes
 */

'use strict';

const { Trek, TrekStage, sequelize } = require('../models');
const { Op } = require('sequelize');

const DRY_RUN = !process.argv.includes('--apply');

async function run() {
    try {
        console.log(`🔍 fix-trek-city-ids  [${DRY_RUN ? 'DRY RUN — pass --apply to write' : 'APPLY MODE'}]\n`);

        // Find treks where city_ids is NULL, empty array "[]", or empty string
        const treks = await Trek.findAll({
            where: {
                status: 'active',
                [Op.or]: [
                    { city_ids: null },
                    { city_ids: '[]' },
                    { city_ids: '' },
                ],
            },
            attributes: ['id', 'title', 'city_ids'],
        });

        console.log(`Found ${treks.length} active trek(s) with empty city_ids.\n`);

        if (treks.length === 0) {
            console.log('✅ Nothing to fix.');
            return;
        }

        let fixed = 0;
        let skipped = 0;

        for (const trek of treks) {
            // Gather city_ids from boarding stages first
            let stages = await TrekStage.findAll({
                where: { trek_id: trek.id, is_boarding_point: true },
                attributes: ['city_id'],
            });

            // Fall back to all stages if no boarding points are seeded
            if (stages.length === 0) {
                stages = await TrekStage.findAll({
                    where: { trek_id: trek.id, city_id: { [Op.not]: null } },
                    attributes: ['city_id'],
                });
            }

            const cityIds = [...new Set(
                stages
                    .map(s => s.city_id)
                    .filter(id => id != null && !isNaN(parseInt(id)))
                    .map(id => parseInt(id))
            )];

            if (cityIds.length === 0) {
                console.log(`  ⚠️  Trek ${trek.id} "${trek.title}" — no TrekStage city_ids found, skipping.`);
                skipped++;
                continue;
            }

            console.log(`  ${DRY_RUN ? '(dry)' : '✏️ '} Trek ${trek.id} "${trek.title}" → city_ids = [${cityIds.join(', ')}]`);

            if (!DRY_RUN) {
                await trek.update({ city_ids: cityIds });
            }
            fixed++;
        }

        console.log(`\nDone. Fixed: ${fixed}, Skipped (no stages): ${skipped}.`);
        if (DRY_RUN && fixed > 0) {
            console.log('\nRe-run with --apply to commit these changes.');
        }
    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error(err.stack);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
}

run();
