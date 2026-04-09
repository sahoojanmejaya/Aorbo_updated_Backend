const {
    Trek,
    Vendor,
    TrekCaptain,
    ItineraryItem,
    Accommodation,
    TrekImage,
    TrekStage,
    Batch,
    Destination,
    Activity,
    City,
    sequelize,
} = require("../../models");
const { validationResult } = require("express-validator");
const { saveBase64Image, deleteImage } = require("../../utils/fileUpload");
const { Op } = require("sequelize");
const logger = require("../../utils/logger");

/**
 * Unified Trek Creation Controller
 * Creates trek with all related entities in a single transaction
 * Ensures atomic operation - all succeed or all fail
 */
exports.createCompleteTrek = async (req, res) => {
    const startTime = Date.now();
    const requestId = `create-complete-trek-${Date.now()}`;
    let transaction;
    let createdTrek = null;
    let targetTrek = null; // can be existing trek when merging
    let isUsingExistingTrek = false;
    let uploadedImagePaths = [];

    try {
        const vendorId = req.user?.id;

        logger.trek("info", "Unified trek creation started", {
            requestId,
            vendorId,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
        });

        // Validate vendor authentication
        if (!vendorId) {
            logger.trek("warn", "Create trek access denied - no vendor ID", {
                requestId,
                ip: req.ip,
            });
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Parse trekData from JSON (FormData sends it as string)
        if (req.body.trekData && typeof req.body.trekData === 'string') {
            try {
                const parsedData = JSON.parse(req.body.trekData);
                
                logger.trek("info", "✅ Parsed trekData from FormData", {
                    requestId,
                    hasParsedData: !!parsedData,
                    parsedKeys: Object.keys(parsedData)
                });
                
                // Replace req.body with parsed data (keep caption_X and isCover_X from FormData)
                const formDataFields = {};
                Object.keys(req.body).forEach(key => {
                    if (key.startsWith('caption_') || key.startsWith('isCover_')) {
                        formDataFields[key] = req.body[key];
                    }
                });
                
                // Merge: parsed trek data + FormData fields
                req.body = { ...parsedData, ...formDataFields };
                
                logger.trek("info", "✅ req.body updated with parsed data", {
                    requestId,
                    finalBodyKeys: Object.keys(req.body),
                    hasTitle: !!req.body.title,
                    hasDestination: !!req.body.destination_id
                });
                
            } catch (parseError) {
                logger.trek("error", "❌ Failed to parse trekData JSON", {
                    requestId,
                    error: parseError.message,
                    trekDataSample: req.body.trekData?.substring(0, 100)
                });
                return res.status(400).json({
                    success: false,
                    message: "Invalid trek data format",
                    error: parseError.message
                });
            }
        }

        // Extract data from request body
        const {
            // Main trek data
            title,
            description,
            destination_id,
            captain_id,
            city_ids,
            duration,
            duration_days,
            duration_nights,
            base_price,
            max_participants,
            trekking_rules,
            emergency_protocols,
            organizer_notes,
            inclusions,
            exclusions,
            status = "deactive",
            has_discount,
            discount_type,
            discount_value,
            cancellation_policy_id,
            activities,
            badge_id,
            
            // Related entities
            trekStages = [],
            itineraryItems = [],
            accommodations = [],
            images = [],
            batches = [],
        } = req.body;

        // Start database transaction
        transaction = await sequelize.transaction();

        logger.trek("info", "Transaction started", { requestId, vendorId });

        // Step 1: Validate all foreign key references
        logger.trek("info", "Validating foreign key references", { requestId });

        // Validate destination
        if (destination_id) {
            const destination = await Destination.findByPk(destination_id, { transaction });
            if (!destination) {
                throw new Error("Selected destination does not exist");
            }
        }

        // Validate cities
        if (city_ids && Array.isArray(city_ids)) {
            const cities = await City.findAll({
                where: { id: city_ids },
                transaction,
            });
            if (cities.length !== city_ids.length) {
                throw new Error("One or more selected cities do not exist");
            }
        }

        // Validate activities
        if (activities && Array.isArray(activities) && activities.length > 0) {
            const validActivities = await Activity.findAll({
                where: { id: activities, is_active: true },
                transaction,
            });
            if (validActivities.length !== activities.length) {
                throw new Error("One or more activity IDs are invalid or inactive");
            }
        }

        // Validate captain
        if (captain_id && captain_id !== "none") {
            const captain = await TrekCaptain.findOne({
                where: {
                    id: captain_id,
                    vendor_id: vendorId,
                    status: "active",
                },
                transaction,
            });
            if (!captain) {
                throw new Error("Selected captain does not exist or is not active");
            }
        }

        // Prepare batches array for potential filtering (duplicate dates etc.)
        let batchesToCreate = Array.isArray(batches) ? [...batches] : [];
        let skippedConflictingStartDates = [];

        // Step 2: Check for duplicate trek (same title + destination + vendor + dates)
        logger.trek("info", "Checking for duplicate trek", { requestId });
        
        if (title && destination_id && batchesToCreate && batchesToCreate.length > 0) {
            // Check for exact duplicate: same title + destination + vendor
            const existingTrek = await Trek.findOne({
                where: {
                    vendor_id: vendorId,
                    destination_id: destination_id,
                    title: title,  // ✅ Added title check - only block if same title
                    status: "active",
                },
                include: [
                    {
                        model: Batch,
                        as: "batches",
                        attributes: ["start_date", "end_date"],
                    },
                ],
                transaction,
            });

            if (existingTrek) {
                // Collect existing start dates for this trek
                const existingStartDates = new Set(
                    (existingTrek.batches || []).map(b => b.start_date)
                );

                // Filter out conflicting dates instead of failing entirely
                const filtered = [];
                for (const b of batchesToCreate) {
                    if (existingStartDates.has(b.start_date)) {
                        skippedConflictingStartDates.push(b.start_date);
                    } else {
                        filtered.push(b);
                    }
                }
                batchesToCreate = filtered;

                // If all proposed dates conflict, respond gracefully with success (no-op)
                if (batchesToCreate.length === 0) {
                    try {
                        if (transaction && !transaction.finished) {
                            await transaction.rollback();
                        }
                    } catch (_) {}

                    return res.status(200).json({
                        success: true,
                        message: "No new batches to add. All selected dates already exist for this trek.",
                        skippedConflictingStartDates,
                    });
                }

                logger.trek("info", "Filtered out conflicting batch dates", {
                    requestId,
                    skipped: skippedConflictingStartDates,
                    remainingCount: batchesToCreate.length,
                });

                // Use existing trek instead of creating a new one (merge mode)
                targetTrek = existingTrek;
                isUsingExistingTrek = true;
            }
        }

        // Step 3: Generate IDs
        const generateMtrId = () => {
            const timestamp = Date.now().toString().slice(-2);
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            let random = "";
            for (let i = 0; i < 5; i++) {
                random += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return `MTR${timestamp}${random}`;
        };

        const generateTbrId = () => {
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            let result = "TBR";
            for (let i = 0; i < 7; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        };

        // Step 4: Create or reuse main trek record
        if (!isUsingExistingTrek) {
            logger.trek("info", "Creating main trek record", { requestId });

            const trekData = {
                mtr_id: generateMtrId(),
                title,
                description,
                vendor_id: vendorId,
                destination_id,
                captain_id: captain_id === "none" ? null : captain_id,
                city_ids: city_ids || [],
                duration,
                duration_days,
                duration_nights,
                base_price,
                max_participants,
                trekking_rules,
                emergency_protocols,
                organizer_notes,
                inclusions: inclusions || [],
                exclusions: exclusions || [],
                status,
                has_discount: has_discount || false,
                discount_type,
                discount_value: discount_value || 0,
                cancellation_policy_id,
                activities: activities || [],
                badge_id,
                has_been_edited: 0,
            };

            createdTrek = await Trek.create(trekData, { transaction });
            targetTrek = createdTrek;

            logger.trek("info", "Main trek created", {
                requestId,
                trekId: createdTrek.id,
                mtrId: createdTrek.mtr_id,
            });
        } else {
            logger.trek("info", "Merging batches into existing trek", {
                requestId,
                trekId: targetTrek.id,
                title: targetTrek.title,
            });
        }

        // Step 5: Create batches first (needed for trek stages)
        let createdBatches = [];
        
        if (batchesToCreate && batchesToCreate.length > 0) {
            logger.trek("info", "Creating batches", {
                requestId,
                count: batchesToCreate.length,
                batches: batchesToCreate.map(b => ({
                    start_date: b.start_date,
                    end_date: b.end_date,
                    capacity: b.capacity
                }))
            });

            // Validate batch dates
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (const batch of batchesToCreate) {
                const startDate = new Date(batch.start_date);
                const endDate = new Date(batch.end_date);

                logger.trek("info", "Validating batch dates", {
                    requestId,
                    startDate: batch.start_date,
                    endDate: batch.end_date,
                    startDateObj: startDate,
                    endDateObj: endDate,
                    today: today
                });

                if (startDate < today) {
                    throw new Error("Cannot create batches with dates in the past");
                }

                if (startDate >= endDate) {
                    throw new Error("Batch start date must be before end date");
                }
            }

            const batchPromises = batchesToCreate.map((batch, index) => {
                const tbrId = generateTbrId();
                logger.trek("info", "Creating batch", {
                    requestId,
                    batchIndex: index,
                    tbrId: tbrId,
                    startDate: batch.start_date,
                    endDate: batch.end_date,
                    capacity: batch.capacity || max_participants || 20
                });
                
                return Batch.create(
                    {
                        tbr_id: tbrId,
                        trek_id: targetTrek.id,
                        start_date: batch.start_date,
                        end_date: batch.end_date,
                        capacity: batch.capacity || max_participants || 20,
                        booked_slots: 0,
                        available_slots: batch.capacity || max_participants || 20,
                    },
                    { transaction }
                );
            });

            createdBatches = await Promise.all(batchPromises);
            logger.trek("info", "Batches created successfully", { 
                requestId,
                createdBatches: createdBatches.map(b => ({
                    id: b.id,
                    tbr_id: b.tbr_id,
                    start_date: b.start_date,
                    end_date: b.end_date
                }))
            });
        } else {
            logger.trek("warn", "No batches provided for trek creation", { requestId });
        }

        // Step 6: Create trek stages with return-based batch assignment logic
        if (trekStages && trekStages.length > 0) {
            logger.trek("info", "Creating trek stages with return-based batch logic", {
                requestId,
                count: trekStages.length,
                batchesCount: createdBatches.length,
            });

            // Apply return-based logic: when stage_name = "return" and destination = "Home Location", 
            // next stages should get the next batch_id
            let currentBatchIndex = 0;
            let stagesInCurrentBatch = 0;
            const stagesPerBatch = 3; // boarding, meeting, return
            
            const stagePromises = [];
            
            for (let i = 0; i < trekStages.length; i++) {
                const stage = trekStages[i];
                
                // Get the target batch
                const targetBatch = createdBatches[currentBatchIndex];
                
                if (!targetBatch) {
                    throw new Error(`No batch available for stage ${i + 1}`);
                }
                
                const stageData = {
                    trek_id: targetTrek.id,
                    batch_id: targetBatch.id, // Assign proper batch_id
                    stage_name: stage.stage_name || stage.type,
                    destination: stage.destination || "",
                    means_of_transport: stage.means_of_transport || stage.transport || "",
                    date_time: stage.date_time || `${stage.time} ${stage.ampm}` || "",
                    is_boarding_point: stage.is_boarding_point || false,
                    city_id: stage.city_id || null,
                };
                
                const stagePromise = TrekStage.create(stageData, { transaction });
                stagePromises.push(stagePromise);
                
                logger.trek("info", "Stage created with batch assignment", {
                    requestId,
                    stageIndex: i,
                    stageName: stageData.stage_name,
                    destination: stageData.destination,
                    batchId: targetBatch.id,
                    batchIndex: currentBatchIndex
                });
                
                stagesInCurrentBatch++;
                
                // Check if this is a "return" stage with "Home Location" destination
                if (stageData.stage_name === "return" && 
                    stageData.destination === "Home Location" && 
                    stagesInCurrentBatch >= stagesPerBatch) {
                    
                    // Move to next batch for the next stage
                    currentBatchIndex++;
                    stagesInCurrentBatch = 0;
                    
                    // If we've used all batches, cycle back to the beginning
                    if (currentBatchIndex >= createdBatches.length) {
                        currentBatchIndex = 0;
                    }
                    
                    logger.trek("info", "Return stage completed, moving to next batch", {
                        requestId,
                        nextBatchIndex: currentBatchIndex,
                        nextBatchId: createdBatches[currentBatchIndex]?.id
                    });
                }
            }

            await Promise.all(stagePromises);
            logger.trek("info", "Trek stages created with return-based batch logic", { 
                requestId,
                totalStagesCreated: stagePromises.length,
                batchesUsed: createdBatches.length
            });
        }

        // Step 7: Create itinerary items
        if (itineraryItems && itineraryItems.length > 0) {
            logger.trek("info", "Creating itinerary items", {
                requestId,
                count: itineraryItems.length,
            });

            const itineraryPromises = itineraryItems.map((item) =>
                ItineraryItem.create(
                    {
                        trek_id: createdTrek.id,
                        activities: item.activities || [],
                    },
                    { transaction }
                )
            );

            await Promise.all(itineraryPromises);
            logger.trek("info", "Itinerary items created", { requestId });
        }

        // Step 8: Create accommodations (assign to each batch)
        if (accommodations && accommodations.length > 0 && createdBatches.length > 0) {
            logger.trek("info", "Creating accommodations for each batch", {
                requestId,
                count: accommodations.length,
                batchesCount: createdBatches.length,
            });

            const accommodationPromises = [];
            
            // Create accommodations for each batch
            for (const batch of createdBatches) {
                for (const acc of accommodations) {
                    const accommodationPromise = Accommodation.create(
                        {
                            trek_id: targetTrek.id,
                            batch_id: batch.id, // ✅ Assign accommodation to specific batch
                            type: acc.type || "",
                            details: {
                                night: acc.night || acc.details?.night || 1,
                                location: acc.location || acc.details?.location || "",
                            },
                        },
                        { transaction }
                    );
                    accommodationPromises.push(accommodationPromise);
                }
            }

            await Promise.all(accommodationPromises);
            logger.trek("info", "Accommodations created for all batches", { 
                requestId,
                totalAccommodationsCreated: accommodationPromises.length,
                accommodationsPerBatch: accommodations.length,
                batchesCount: createdBatches.length
            });
        }

        // Step 9: Process and save images (from multer req.files)
        if (!isUsingExistingTrek && req.files && req.files.length > 0) {
            logger.trek("info", "Processing uploaded images", {
                requestId,
                count: req.files.length,
            });

            const imagePromises = req.files.map(async (file, index) => {
                try {
                    // Multer already saved the file to disk
                    // We need to get the relative path for database storage
                    const path = require('path');
                    const { STORAGE_DIR } = require('../../utils/trekImageUpload');
                    
                    // Get relative path from storage directory
                    const relativePath = path.relative(STORAGE_DIR, file.path);
                    
                    uploadedImagePaths.push(file.path);

                    // Get caption and isCover from req.body (sent via FormData)
                    const caption = req.body[`caption_${index}`] || "";
                    const isCover = req.body[`isCover_${index}`] === "true" || (index === 0);

                    logger.trek("info", "Creating image record", {
                        requestId,
                        index,
                        filename: file.filename,
                        relativePath,
                        caption,
                        isCover,
                    });

                    // Create database record with relative path
                    return TrekImage.create(
                        {
                            trek_id: targetTrek.id,
                            url: relativePath, // Store relative path in database
                            caption: caption,
                            is_cover: isCover,
                        },
                        { transaction }
                    );
                } catch (imageError) {
                    logger.trek("error", "Failed to process image", {
                        requestId,
                        index,
                        filename: file?.filename,
                        error: imageError.message,
                    });
                    throw new Error(`Failed to process image ${index + 1}: ${imageError.message}`);
                }
            });

            await Promise.all(imagePromises);
            logger.trek("info", "Images processed and saved to database", { 
                requestId,
                count: req.files.length 
            });
        }


        // Step 10: Commit transaction
        await transaction.commit();

        const executionDuration = Date.now() - startTime;
        logger.trek("info", "Trek creation completed successfully", {
            requestId,
            vendorId,
            trekId: createdTrek.id,
            mtrId: createdTrek.mtr_id,
            duration: `${executionDuration}ms`,
            entities: {
                stages: trekStages.length,
                itinerary: itineraryItems.length,
                accommodations: accommodations.length,
                images: images.length,
                batches: batches.length,
            },
        });

        // Fetch complete trek data with all relations
        const completeTrek = await Trek.findByPk(createdTrek.id, {
            include: [
                { model: TrekStage, as: "trek_stages" },
                { model: ItineraryItem, as: "itinerary_items" },
                { model: Accommodation, as: "accommodations" },
                { model: TrekImage, as: "images" },
                { model: Batch, as: "batches" },
                { model: Destination, as: "destinationData" },
                { model: TrekCaptain, as: "captain" },
            ],
        });

        res.status(201).json({
            success: true,
            message: "Trek created successfully with all components",
            data: completeTrek,
            skippedConflictingStartDates,
        });

    } catch (error) {
        // Rollback transaction if it exists
        if (transaction && !transaction.finished) {
            await transaction.rollback();
            logger.trek("info", "Transaction rolled back", { requestId });
        }

        // Clean up any uploaded images if trek creation failed
        if (uploadedImagePaths.length > 0) {
            logger.trek("info", "Cleaning up uploaded images", {
                requestId,
                count: uploadedImagePaths.length,
            });

            for (const imagePath of uploadedImagePaths) {
                try {
                    await deleteImage(imagePath);
                } catch (deleteError) {
                    logger.trek("error", "Failed to delete image during cleanup", {
                        requestId,
                        imagePath,
                        error: deleteError.message,
                    });
                }
            }
        }

        const executionDuration = Date.now() - startTime;
        logger.trek("error", "Failed to create complete trek", {
            requestId,
            vendorId: req.user?.id,
            duration: `${executionDuration}ms`,
            error: error.message,
            stack: error.stack,
            body: {
                title: req.body.title,
                destination_id: req.body.destination_id,
                hasStages: !!req.body.trekStages,
                hasItinerary: !!req.body.itineraryItems,
                hasAccommodations: !!req.body.accommodations,
                hasImages: !!req.body.images,
                hasBatches: !!req.body.batches,
            },
        });

        // Determine appropriate error response
        let statusCode = 500;
        let errorMessage = "Failed to create trek";
        let errorDetails = {};

        if (error.message.includes("does not exist")) {
            statusCode = 400;
            errorMessage = error.message;
            errorDetails.type = "VALIDATION_ERROR";
        } else if (error.message.includes("already have a trek")) {
            statusCode = 400;
            errorMessage = error.message;
            errorDetails.type = "DUPLICATE_TREK";
        } else if (error.message.includes("dates in the past")) {
            statusCode = 400;
            errorMessage = error.message;
            errorDetails.type = "INVALID_DATES";
        } else if (error.message.includes("Failed to process image")) {
            statusCode = 400;
            errorMessage = error.message;
            errorDetails.type = "IMAGE_PROCESSING_ERROR";
        }

        res.status(statusCode).json({
            success: false,
            message: errorMessage,
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
            details: errorDetails,
        });
    }
};

/**
 * Update Complete Trek
 * Updates trek with all related entities in a single transaction
 * Note: This is for future implementation when full trek editing is allowed
 */
exports.updateCompleteTrek = async (req, res) => {
    const startTime = Date.now();
    const requestId = `update-complete-trek-${Date.now()}`;
    let transaction;

    try {
        const { id } = req.params;
        const vendorId = req.user?.id;

        logger.trek("info", "Unified trek update started", {
            requestId,
            trekId: id,
            vendorId,
        });

        if (!vendorId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Vendor account required.",
            });
        }

        // Start transaction
        transaction = await sequelize.transaction();

        // Verify trek ownership
        const trek = await Trek.findOne({
            where: { id, vendor_id: vendorId },
            transaction,
        });

        if (!trek) {
            throw new Error("Trek not found");
        }

        // Check if trek has been edited
        if (trek.has_been_edited === 1) {
            throw new Error("This trek has already been edited and cannot be modified further");
        }

        // Extract update data
        const {
            // Main trek data (limited fields for now)
            captain_id,
            
            // Related entities
            accommodations = [],
        } = req.body;

        // Update main trek (limited to captain_id for now)
        if (captain_id !== undefined) {
            await trek.update(
                {
                    captain_id: captain_id === "none" ? null : captain_id,
                    has_been_edited: 1,
                },
                { transaction }
            );
        }

        // Update accommodations if provided
        if (accommodations && accommodations.length > 0) {
            // Delete existing accommodations
            await Accommodation.destroy({
                where: { trek_id: id },
                transaction,
            });

            // Create new accommodations
            const accommodationPromises = accommodations.map((acc) =>
                Accommodation.create(
                    {
                        trek_id: id,
                        type: acc.type || "",
                        details: {
                            night: acc.night || acc.details?.night || 1,
                            location: acc.location || acc.details?.location || "",
                        },
                    },
                    { transaction }
                )
            );

            await Promise.all(accommodationPromises);
        }

        // Commit transaction
        await transaction.commit();

        const executionDuration = Date.now() - startTime;
        logger.trek("info", "Trek update completed successfully", {
            requestId,
            trekId: id,
            vendorId,
            duration: `${executionDuration}ms`,
        });

        // Fetch updated trek
        const updatedTrek = await Trek.findByPk(id, {
            include: [
                { model: Accommodation, as: "accommodations" },
                { model: TrekCaptain, as: "captain" },
            ],
        });

        res.json({
            success: true,
            message: "Trek updated successfully",
            data: updatedTrek,
        });

    } catch (error) {
        // Rollback transaction
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        const executionDuration = Date.now() - startTime;
        logger.trek("error", "Failed to update complete trek", {
            requestId,
            trekId: req.params.id,
            vendorId: req.user?.id,
            duration: `${executionDuration}ms`,
            error: error.message,
            stack: error.stack,
        });

        res.status(500).json({
            success: false,
            message: error.message || "Failed to update trek",
        });
    }
};