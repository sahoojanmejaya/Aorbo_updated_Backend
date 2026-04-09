const db = require("../../models");
const { BannerItem, BannerType } = db;
const { Op } = require("sequelize");
const { uploadBannerItemImages, getRelativePath } = require("../../utils/bannerItemUpload");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Helper function to save base64 image to file system
const saveBase64Image = async (base64Data, fieldName) => {
    try {
        console.log(`Saving base64 image for field: ${fieldName}`);
        console.log(`Base64 data length: ${base64Data.length}`);
        
        // Extract file type from base64 data
        const matches = base64Data.match(/^data:image\/([a-zA-Z]*);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            throw new Error("Invalid base64 image data format");
        }

        const imageType = matches[1]; // png, jpg, jpeg, etc.
        const imageBuffer = Buffer.from(matches[2], "base64");

        console.log(`Image type: ${imageType}, Buffer size: ${imageBuffer.length}`);

        // Generate unique filename
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(8).toString("hex");
        const filename = `${fieldName}-${timestamp}-${randomString}.${imageType}`;

        // Create banner items storage directory if it doesn't exist
        const storageDir = path.join(__dirname, "../storage");
        const bannerItemsDir = path.join(storageDir, "banner_items");
        
        console.log(`Storage directory: ${storageDir}`);
        console.log(`Banner items directory: ${bannerItemsDir}`);
        
        if (!fs.existsSync(bannerItemsDir)) {
            fs.mkdirSync(bannerItemsDir, { recursive: true });
            console.log("Created banner items directory");
        }

        // Save file
        const filePath = path.join(bannerItemsDir, filename);
        fs.writeFileSync(filePath, imageBuffer);
        
        console.log(`File saved to: ${filePath}`);

        // Return relative path from storage root
        const relativePath = `banner_items/${filename}`;
        console.log(`Returning relative path: ${relativePath}`);
        return relativePath;
    } catch (error) {
        console.error("Error saving base64 image:", error);
        console.error("Error stack:", error.stack);
        throw new Error(`Failed to save base64 image: ${error.message}`);
    }
};

// Helper function to process icon URL (handle base64, file paths, and URLs)
const processIconUrl = async (iconUrl) => {
    if (!iconUrl || iconUrl.trim() === '') {
        return null;
    }

    // Safety check: Never return base64 strings
    if (iconUrl.startsWith('data:image/')) {
        console.log("Base64 URL detected, converting to file...");
        try {
            const filePath = await saveBase64Image(iconUrl, 'icon_image');
            console.log("Base64 converted to file:", filePath);
            return filePath;
        } catch (error) {
            console.error("Failed to process base64 icon:", error);
            return null;
        }
    }

    // If it's already a proper file path, return as is (but check length)
    if (iconUrl.includes('banner_items/') || iconUrl.includes('icon_image-')) {
        if (iconUrl.length > 500) {
            console.warn("File path too long, setting to null:", iconUrl.substring(0, 50) + "...");
            return null;
        }
        return iconUrl;
    }

    // If it's a full URL (like Google search URLs), return null to avoid storing invalid URLs
    if (iconUrl.startsWith('http://') || iconUrl.startsWith('https://')) {
        console.warn("Invalid URL detected for icon, ignoring:", iconUrl.substring(0, 50) + "...");
        return null;
    }

    // Safety check: If the string is too long, it's likely base64 or invalid data
    if (iconUrl.length > 500) {
        console.warn("String too long for database field, setting to null:", iconUrl.substring(0, 50) + "...");
        return null;
    }

    // For any other case, return null
    return null;
};

// Public API: Get all active banner items with banner type details (No authentication required)
const getPublicBannerItems = async (req, res) => {
    try {
        const bannerItems = await BannerItem.findAll({
            where: { 
                status: 'active',
                deleted_at: null
            },
            include: [
                {
                    model: BannerType,
                    as: "bannerType",
                    attributes: ['id', 'name', 'description', 'order', 'status'],
                    where: { 
                        status: 'active',
                        deleted_at: null
                    },
                    required: true
                }
            ],
            attributes: [
                'id', 'banner_type_id', 'title', 'subtitle', 'description', 
                'description_main', 'sub_description', 'icon_url', 'img_url',
                'background_type', 'text_color', 'text_alignment', 'primary_color',
                'secondary_color', 'background_image', 'button_text', 'link_url',
                'priority', 'status', 'start_date', 'end_date', 'created_at', 'updated_at'
            ],
            order: [['priority', 'ASC'], ['id', 'ASC']]
        });

        res.json({
            success: true,
            data: bannerItems
        });
    } catch (error) {
        console.error("Error fetching public banner items:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch banner items",
            error: error.message
        });
    }
};

// Get all banner items with pagination and filtering
const getAllBannerItems = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            search = "",
            status = "",
            banner_type_id = "",
            sortBy = "created_at",
            sortOrder = "DESC"
        } = req.query;

        const offset = (page - 1) * limit;
        const whereClause = {};

        // Add search filter
        if (search) {
            whereClause[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { subtitle: { [Op.like]: `%${search}%` } }
            ];
        }

        // Add status filter
        if (status) {
            whereClause.status = status;
        }

        // Add banner type filter
        if (banner_type_id) {
            whereClause.banner_type_id = banner_type_id;
        }

        // Add condition to exclude soft-deleted items
        whereClause.deleted_at = null;

        const { count, rows: bannerItems } = await BannerItem.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: BannerType,
                    as: "bannerType",
                    attributes: ['id', 'name']
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [[sortBy, sortOrder.toUpperCase()], ['id', 'ASC']],
            attributes: [
                'id', 'banner_type_id', 'title', 'subtitle', 'description', 
                'description_main', 'sub_description', 'icon_url', 'img_url',
                'background_type', 'text_color', 'text_alignment', 'primary_color',
                'secondary_color', 'background_image', 'button_text', 'link_url',
                'priority', 'status', 'start_date', 'end_date', 'created_at', 'updated_at'
            ]
        });

        res.json({
            success: true,
            data: {
                bannerItems,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(count / limit),
                    totalItems: count,
                    itemsPerPage: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error("Error fetching banner items:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch banner items",
            error: error.message
        });
    }
};

// Get single banner item by ID
const getBannerItemById = async (req, res) => {
    try {
        const { id } = req.params;

        const bannerItem = await BannerItem.findOne({
            where: { 
                id: id,
                deleted_at: null
            },
            include: [
                {
                    model: BannerType,
                    as: "bannerType",
                    attributes: ['id', 'name']
                }
            ],
            attributes: [
                'id', 'banner_type_id', 'title', 'subtitle', 'description', 
                'description_main', 'sub_description', 'icon_url', 'img_url',
                'background_type', 'text_color', 'text_alignment', 'primary_color',
                'secondary_color', 'background_image', 'button_text', 'link_url',
                'priority', 'status', 'start_date', 'end_date', 'created_at', 'updated_at'
            ]
        });

        if (!bannerItem) {
            return res.status(404).json({
                success: false,
                message: "Banner item not found"
            });
        }

        res.json({
            success: true,
            data: bannerItem
        });
    } catch (error) {
        console.error("Error fetching banner item:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch banner item",
            error: error.message
        });
    }
};

// Create new banner item
const createBannerItem = async (req, res) => {
    try {
        const {
            banner_type_id,
            title,
            subtitle,
            icon_url,
            image_url,
            background_image,
            main_descriptions,
            dynamic_rows,
            style,
            cta,
            priority,
            status
        } = req.body;


        // Parse JSON fields that come as strings from FormData
        let parsedMainDescriptions = main_descriptions;
        let parsedDynamicRows = dynamic_rows;
        let parsedStyle = style;
        let parsedCta = cta;

        try {
            if (typeof main_descriptions === 'string') {
                parsedMainDescriptions = JSON.parse(main_descriptions);
            }
            if (typeof dynamic_rows === 'string') {
                parsedDynamicRows = JSON.parse(dynamic_rows);
            }
            if (typeof style === 'string') {
                parsedStyle = JSON.parse(style);
            }
            if (typeof cta === 'string') {
                parsedCta = JSON.parse(cta);
            }
        } catch (error) {
            console.error("Error parsing JSON fields:", error);
            return res.status(400).json({
                success: false,
                message: "Invalid JSON data in form fields"
            });
        }


        // Handle file uploads and process icon URL
        let iconImagePath = null;
        let mainImagePath = image_url; // Keep existing URL if no file uploaded

        // Process icon URL (handle base64, file uploads, or existing paths)
        if (req.files && req.files.icon_image && req.files.icon_image[0]) {
            // Handle uploaded icon file - same logic as image upload
            const fullPath = req.files.icon_image[0].path;
            iconImagePath = getRelativePath(fullPath);
            
            console.log("Icon uploaded as file:");
            console.log("  Full path:", fullPath);
            console.log("  Relative path:", iconImagePath);
            console.log("  Path length:", iconImagePath.length);
            
            // Ensure the path is not too long for database
            if (iconImagePath && iconImagePath.length > 500) {
                console.error("❌ Icon path too long for database:", iconImagePath.length);
                iconImagePath = null;
            }
        } else if (icon_url) {
            // Process icon URL (could be base64, file path, or invalid URL)
            console.log("Processing icon URL:", icon_url.substring(0, 100) + "...");
            try {
                iconImagePath = await processIconUrl(icon_url);
                console.log("Processed icon URL result:", iconImagePath);
            } catch (error) {
                console.error("Error processing icon URL:", error);
                iconImagePath = null;
            }
        }
        
        // Handle main image upload
        if (req.files && req.files.main_image && req.files.main_image[0]) {
            const fullPath = req.files.main_image[0].path;
            mainImagePath = getRelativePath(fullPath);
            console.log("Main image uploaded as file:");
            console.log("  Full path:", fullPath);
            console.log("  Relative path:", mainImagePath);
            console.log("  Path length:", mainImagePath.length);
            
            // Ensure the path is not too long for database
            if (mainImagePath && mainImagePath.length > 500) {
                console.error("❌ Main image path too long for database:", mainImagePath.length);
                mainImagePath = null;
            }
        }

        console.log("Creating banner item with data:", { 
            title, 
            subtitle, 
            banner_type_id,
            main_descriptions: parsedMainDescriptions,
            dynamic_rows: parsedDynamicRows,
            style: parsedStyle,
            cta: parsedCta
        });
        
        // Debug: Log request data
        console.log("Raw request body:", req.body);
        console.log("Title check:", { title, titleType: typeof title, titleLength: title?.length, isEmpty: title === '' });
        console.log("Banner type check:", { banner_type_id, bannerTypeIdType: typeof banner_type_id, bannerTypeIdLength: banner_type_id?.toString().length });

        // Validate required fields - check for empty strings and null/undefined
        if (!title || title.trim() === '' || !banner_type_id || banner_type_id.toString().trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Title and banner type are required"
            });
        }

        // Check if banner type exists
        const bannerType = await BannerType.findByPk(banner_type_id);
        if (!bannerType) {
            return res.status(400).json({
                success: false,
                message: "Invalid banner type"
            });
        }

        // Auto-assign the next available priority number
        let nextPriority = 1;
        if (priority !== undefined && priority !== null && priority !== "") {
            // Check if the requested priority is available
            const existingPriority = await BannerItem.findOne({
                where: { priority: parseInt(priority) }
            });
            if (existingPriority) {
                return res.status(400).json({
                    success: false,
                    message: `Priority ${priority} is already taken. Please choose another priority.`
                });
            }
            nextPriority = parseInt(priority);
        } else {
            // Find the highest priority number and add 1
            const maxPriority = await BannerItem.max('priority');
            nextPriority = maxPriority ? maxPriority + 1 : 1;
        }

        // Safety check: Ensure no base64 strings are stored directly
        const safeIconUrl = iconImagePath && iconImagePath.length > 500 ? null : iconImagePath;
        const safeImgUrl = mainImagePath && mainImagePath.length > 500 ? null : mainImagePath;
        
        console.log("Safety check results:");
        console.log("  iconImagePath:", iconImagePath ? `${iconImagePath.substring(0, 50)}...` : null);
        console.log("  iconImagePath length:", iconImagePath ? iconImagePath.length : 0);
        console.log("  safeIconUrl:", safeIconUrl ? `${safeIconUrl.substring(0, 50)}...` : null);
        console.log("  mainImagePath:", mainImagePath ? `${mainImagePath.substring(0, 50)}...` : null);
        console.log("  mainImagePath length:", mainImagePath ? mainImagePath.length : 0);
        console.log("  safeImgUrl:", safeImgUrl ? `${safeImgUrl.substring(0, 50)}...` : null);

        // Transform the frontend data structure to match database schema
        const bannerItemData = {
            banner_type_id: parseInt(banner_type_id),
            title,
            subtitle: subtitle || null,
            icon_url: safeIconUrl || null,
            img_url: safeImgUrl || null,
            background_image: background_image || null,
            background_type: parsedStyle?.background_type || "gradient",
            text_color: parsedStyle?.text_color || "#FFFFFF",
            text_alignment: parsedStyle?.alignment || "left",
            primary_color: parsedStyle?.background_colors?.[0] || "#1E90FF",
            secondary_color: parsedStyle?.background_colors?.[1] || null,
            button_text: parsedCta?.text || "View More",
            link_url: parsedCta?.link || null,
            priority: nextPriority,
            status: status || "active",
            // Store complex data as JSON objects (not strings)
            description_main: parsedMainDescriptions || null,
            sub_description: parsedDynamicRows || null,
        };

        console.log("Banner item data to be saved:", {
            ...bannerItemData,
            icon_url: bannerItemData.icon_url ? `${bannerItemData.icon_url.substring(0, 50)}...` : null,
            img_url: bannerItemData.img_url ? `${bannerItemData.img_url.substring(0, 50)}...` : null
        });
        
        // Final safety check before database save
        if (bannerItemData.icon_url && bannerItemData.icon_url.length > 500) {
            console.error("CRITICAL: icon_url is too long for database, setting to null");
            console.error("  Length:", bannerItemData.icon_url.length);
            console.error("  Value:", bannerItemData.icon_url.substring(0, 100) + "...");
            bannerItemData.icon_url = null;
        }
        if (bannerItemData.img_url && bannerItemData.img_url.length > 500) {
            console.error("CRITICAL: img_url is too long for database, setting to null");
            console.error("  Length:", bannerItemData.img_url.length);
            console.error("  Value:", bannerItemData.img_url.substring(0, 100) + "...");
            bannerItemData.img_url = null;
        }
        
        console.log("Final data to save:");
        console.log("  icon_url:", bannerItemData.icon_url ? `${bannerItemData.icon_url.substring(0, 50)}...` : null);
        console.log("  icon_url length:", bannerItemData.icon_url ? bannerItemData.icon_url.length : 0);
        console.log("  img_url:", bannerItemData.img_url ? `${bannerItemData.img_url.substring(0, 50)}...` : null);
        console.log("  img_url length:", bannerItemData.img_url ? bannerItemData.img_url.length : 0);
        
        const bannerItem = await BannerItem.create(bannerItemData);

        // Fetch the created item with relations
        const createdItem = await BannerItem.findByPk(bannerItem.id, {
            include: [
                {
                    model: BannerType,
                    as: "bannerType",
                    attributes: ['id', 'name']
                }
            ]
        });

        res.status(201).json({
            success: true,
            message: "Banner item created successfully",
            data: createdItem
        });
    } catch (error) {
        console.error("Error creating banner item:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create banner item",
            error: error.message
        });
    }
};

// Update banner item
const updateBannerItem = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const bannerItem = await BannerItem.findByPk(id);

        if (!bannerItem) {
            return res.status(404).json({
                success: false,
                message: "Banner item not found"
            });
        }

        // Check if banner type exists if being updated
        if (updateData.banner_type_id) {
            const bannerType = await BannerType.findByPk(updateData.banner_type_id);
            if (!bannerType) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid banner type"
                });
            }
        }


        // Process icon URL if being updated
        if (updateData.icon_url) {
            console.log("Processing icon URL in update:", updateData.icon_url.substring(0, 100) + "...");
            try {
                updateData.icon_url = await processIconUrl(updateData.icon_url);
                console.log("Processed icon URL result:", updateData.icon_url);
            } catch (error) {
                console.error("Error processing icon URL:", error);
                updateData.icon_url = null;
            }
        }

        // Safety check for update data
        if (updateData.icon_url && updateData.icon_url.length > 500) {
            console.error("CRITICAL: icon_url is too long for database, setting to null");
            updateData.icon_url = null;
        }
        if (updateData.img_url && updateData.img_url.length > 500) {
            console.error("CRITICAL: img_url is too long for database, setting to null");
            updateData.img_url = null;
        }

        // Transform style and cta data if provided
        const transformedData = { ...updateData };
        
        if (updateData.style) {
            transformedData.background_type = updateData.style.background_type;
            transformedData.text_color = updateData.style.text_color;
            transformedData.text_alignment = updateData.style.alignment;
            transformedData.primary_color = updateData.style.background_colors?.[0];
            transformedData.secondary_color = updateData.style.background_colors?.[1];
            delete transformedData.style;
        }

        if (updateData.cta) {
            transformedData.button_text = updateData.cta.text;
            transformedData.link_url = updateData.cta.link;
            delete transformedData.cta;
        }

        if (updateData.main_descriptions) {
            transformedData.description_main = updateData.main_descriptions;
            delete transformedData.main_descriptions;
        }

        if (updateData.dynamic_rows) {
            transformedData.sub_description = updateData.dynamic_rows;
            delete transformedData.dynamic_rows;
        }

        if (updateData.image_url) {
            transformedData.img_url = updateData.image_url;
            delete transformedData.image_url;
        }

        await bannerItem.update(transformedData);

        // Fetch the updated item with relations
        const updatedItem = await BannerItem.findByPk(id, {
            include: [
                {
                    model: BannerType,
                    as: "bannerType",
                    attributes: ['id', 'name']
                }
            ]
        });

        res.json({
            success: true,
            message: "Banner item updated successfully",
            data: updatedItem
        });
    } catch (error) {
        console.error("Error updating banner item:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update banner item",
            error: error.message
        });
    }
};

// Delete banner item (soft delete) with priority renumbering (matching Banner Type implementation)
const deleteBannerItem = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    
    try {
        const { id } = req.params;

        const bannerItem = await BannerItem.findByPk(id, { transaction });

        if (!bannerItem) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: "Banner item not found"
            });
        }

        const deletedPriority = bannerItem.priority;

        // Soft delete the banner item using destroy() method (matching Banner Type)
        await bannerItem.destroy({ transaction });

        // Renumber all banner items with priority greater than the deleted one (matching Banner Type)
        await BannerItem.update(
            { priority: db.sequelize.literal('`priority` - 1') },
            { 
                where: { 
                    priority: { [Op.gt]: deletedPriority },
                    deleted_at: null
                },
                transaction 
            }
        );

        await transaction.commit();

        res.json({
            success: true,
            message: "Banner item deleted successfully and priorities renumbered"
        });
    } catch (error) {
        await transaction.rollback();
        console.error("Error deleting banner item:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete banner item",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Reorder banner items by priority
const reorderBannerItems = async (req, res) => {
    try {
        const { reorderedItems } = req.body;

        if (!Array.isArray(reorderedItems)) {
            return res.status(400).json({
                success: false,
                message: "Invalid reordered items format"
            });
        }

        console.log("Received reorder request:", reorderedItems);

        // Use transaction to ensure all updates happen atomically
        const transaction = await db.sequelize.transaction();

        try {
            // Update the priority for each banner item sequentially
            for (const item of reorderedItems) {
                await BannerItem.update(
                    { priority: item.priority },
                    { 
                        where: { id: item.id },
                        transaction: transaction
                    }
                );
                console.log(`Updated BannerItem ${item.id} to priority ${item.priority}`);
            }

            await transaction.commit();

            res.json({
                success: true,
                message: "Banner items reordered successfully"
            });
        } catch (updateError) {
            await transaction.rollback();
            throw updateError;
        }
    } catch (error) {
        console.error("Error reordering banner items:", error);
        res.status(500).json({
            success: false,
            message: "Failed to reorder banner items",
            error: error.message
        });
    }
};

module.exports = {
    getPublicBannerItems,
    getAllBannerItems,
    getBannerItemById,
    createBannerItem,
    updateBannerItem,
    deleteBannerItem,
    reorderBannerItems
};
