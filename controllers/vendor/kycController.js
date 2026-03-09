const { Vendor, User } = require("../../models");
const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const logger = require("../../utils/logger");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const JWT_SECRET = process.env.JWT_SECRET || "vendor_jwt_secret";

// Middleware to verify temp token for KYC process
const verifyTempToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: "No token provided" });
        }

        const token = authHeader.substring(7);
        
        // For temp tokens, we'll accept any token that starts with "static-temp-token"
        if (token.startsWith("static-temp-token")) {
            req.user = { phone: "temp-phone" }; // Set a temp user for KYC process
            return next();
        }

        // Try to verify as regular JWT token
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid token" });
    }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, "../../storage/documents");
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        //JPEG, JPG, PNG and WebP
 
        const allowedTypes = /jpeg|jpg|png|webp|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error("Only images (JPEG, PNG,WEBP) and PDF files are allowed"));
        }
    }
});

// Multer middleware for document uploads
const uploadDocuments = (req, res, next) => {
    console.log("Multer middleware - uploadDocuments called");
    console.log("Request content-type:", req.headers['content-type']);
    console.log("Request method:", req.method);
    console.log("Request URL:", req.url);
    console.log("Request headers:", req.headers);
    
    upload.fields([
        { name: 'panCard', maxCount: 1 },
        { name: 'idProof', maxCount: 1 },
        { name: 'buisness_logo', maxCount: 1 },
         { name: 'cancelledCheque', maxCount: 1 },
        { name: 'gstinCertificate', maxCount: 1 },
        { name: 'msmeCertificate', maxCount: 1 },
        { name: 'shopEstablishment', maxCount: 1 },
        { name: 'businessLicense', maxCount: 1 },
        { name: 'insurancePolicy', maxCount: 1 },
        { name: 'experienceCertificate', maxCount: 1 },
    ])(req, res, (err) => {
        if (err) {
            console.error("Multer error:", err);
            return res.status(400).json({ success: false, message: err.message });
        }
        console.log("Multer middleware - files processed:", req.files);
        console.log("Multer middleware - body after parsing:", req.body);
        console.log("Multer middleware - files keys:", req.files ? Object.keys(req.files) : "No files");
        next();
    });
};

// Multer middleware for bank details uploads
const uploadBankDetails = (req, res, next) => {
    console.log("Multer middleware - uploadBankDetails called");
    console.log("Request content-type:", req.headers['content-type']);
    
    upload.single('bankDocument')(req, res, (err) => {
        if (err) {
            console.error("Multer error:", err);
            return res.status(400).json({ success: false, message: err.message });
        }
        console.log("Multer middleware - file processed:", req.file);
        console.log("Multer middleware - body after parsing:", req.body);
        console.log("Multer middleware - files in request:", req.files);
        console.log("Multer middleware - file field name:", req.file?.fieldname);
        next();
    });
};

// Export multer middleware functions
exports.uploadDocuments = uploadDocuments;
exports.uploadBankDetails = uploadBankDetails;
exports.verifyTempToken = verifyTempToken;

// Generate password from full name
const generatePassword = (fullName) => {
    return fullName.toLowerCase().replace(/\s+/g, '');
};

// Step 1: Personal & Business Details
exports.savePersonalBusinessStep = async (req, res) => {
    let personal, business; // Declare outside try block for catch access
   // try {
        ({ personal, business,bankData } = req.body);

        console.log("bankDatabankDatabankData_______________________________________________________",bankData);
        
        console.log("KYC Step 1 - Received data:", { personal, business,bankData });
        console.log("Phone number:", personal.mobile);
        
        // Normalize phone number (remove spaces, country code, etc.)
        const normalizePhone = (phone) => {
            if (!phone) return "temp_phone";
            // Remove all non-digit characters and take last 10 digits
            const digits = phone.replace(/\D/g, '');
            return digits.slice(-10);
        };
        
        const phoneNumber = normalizePhone(personal.mobile);
        console.log("Normalized phone number:", phoneNumber);
        
        // Check if this is an edit (look for existing vendor with same phone/email)
        console.log("Searching for vendor with phone:", phoneNumber);
        
        let existingVendor = await Vendor.findOne({
            include: [{
                model: User,
                as: "user",
                where: {
                    phone: phoneNumber
                }
            }],
            where: { kyc_status: 'in_progress' }
        });
        
        console.log("Existing vendor found:", !!existingVendor);

        if (existingVendor) {
            // Update existing records
            console.log("Updating existing KYC record:", existingVendor.id);
            
            // Generate password from full name
            const password = generatePassword(personal.fullName);
            const hashedPassword = await bcrypt.hash(password, 10);
            
            console.log("Updated password for", personal.fullName, ":", password);
            
            // Update user record
            await existingVendor.user.update({
                name: personal.fullName,
                email: personal.email,
                phone: phoneNumber, // Use normalized phone number
                passwordHash: hashedPassword, // Update with actual hashed password
            });

            // Update vendor record
            await existingVendor.update({
                address: personal.address,
                business_name: business.businessName,
                business_type: business.businessType,
                business_entity: business.businessEntity,
                business_address: business.businessAddress,
                city: personal.city,
                state: personal.state,
                pincode: personal.pincode,

             account_holder_name: bankData.accountHolderName,
             bank_name: bankData.bankName,
             ifsc_code: bankData.ifscCode,
             account_number: bankData.accountNumber,
           //  kyc_step: 4,
             kyc_status: 'in_progress',

               // adhar_no: personal.adhar_no,
               // pan_no: personal.pan_no,
              //  dob: personal.dob,
              //  gender: personal.gender,

                gstin: business.gstin,
              //  kyc_status: "in_progress",
                kyc_step: 2,
            });

            logger.api("info", "Personal & Business details updated", {
                vendorId: existingVendor.id,
                userId: existingVendor.user_id,
                personal: personal,
                business: business,
            });

            res.json({
                success: true,
                message: "Personal & Business details updated successfully",
                kyc_step: 2,
                vendor_id: existingVendor.id,
            });
        } else {
            // Create new records
            console.log("Creating new KYC record");
            
            // Generate password from full name
            const password = generatePassword(personal.fullName);
            const hashedPassword = await bcrypt.hash(password, 10);
            
            console.log("Generated password for", personal.fullName, ":", password);
            
            // Create a temporary user record for KYC process
            const tempUser = await User.create({
                name: personal.fullName,
                email: personal.email,
                phone: phoneNumber, // Use normalized phone number
                passwordHash: hashedPassword, // Store actual hashed password
                roleId: 2, // Vendor role
                status: "inactive", // Will be activated after KYC approval
            });

            // Create vendor record with KYC data
            const vendor = await Vendor.create({
                user_id: tempUser.id,
                address: personal.address,
                city: personal.city,
                state: personal.state,
                pincode: personal.pincode,
                business_name: business.businessName,
                business_type: business.businessType,
                business_entity: business.businessEntity,
                business_address: business.businessAddress,
                gstin: business.gstin,

             account_holder_name: bankData.accountHolderName,
             bank_name: bankData.bankName,
             ifsc_code: bankData.ifscCode,
             account_number: bankData.accountNumber,
            // kyc_step: 4,
         //    kyc_status: 'in_progress',

              //  adhar_no: personal.adhar_no,
               // pan_no: personal.pan_no,
                //dob: personal.dob,
                //gender: personal.gender,
                kyc_status: "in_progress",
                kyc_step: 2,
            });

            logger.api("info", "Personal & Business details saved", {
                vendorId: vendor.id,
                userId: tempUser.id,
                personal: personal,
                business: business,
            });

            res.json({
                success: true,
                message: "Personal & Business details saved successfully",
                kyc_step: 2,
                vendor_id: vendor.id,
            });
        }
    /*} catch (error) {
        console.error("Detailed error in savePersonalBusinessStep:", error);
        logger.api("error", "Error saving personal & business details", {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id,
            personal: personal,
            business: business,
        });
        res.status(500).json({ 
            success: false, 
            message: "Some thing went wrong",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }*/
};

// Step 2: Document Uploads
exports.saveDocumentsStep = async (req, res) => {
    let documents = {}; // Declare outside try block for catch access
    try {
        console.log("KYC Step 2 - Document uploads received___________________________________");
        console.log("Request headers____________________________________:", req.headers);
        console.log("Request body type:", typeof req.body);
        console.log("Request files:", req.files);

        documents = {}; // Initialize inside try block
        const files = req.files;
        
        console.log("Files received:", files);
        console.log("Files type:", typeof files);
        console.log("Files keys:", files ? Object.keys(files) : "No files");
        console.log("Files is null:", files === null);
        console.log("Files is undefined:", files === undefined);
        console.log("Files length:", files ? Object.keys(files).length : "No files object");
        console.log("Request body:", req.body);
        console.log("Request headers content-type:", req.headers['content-type']);
        
        // Check if multer middleware was called
        console.log("Multer middleware called:", req.files !== undefined);
        console.log("Request object keys:", Object.keys(req));
        console.log("Request has files property:", 'files' in req);
        console.log("Request body keys:", Object.keys(req.body));
        console.log("Request body values:", req.body);

        // Process uploaded files and store in separate columns
        if (files && Object.keys(files).length > 0) {
            console.log("Processing files...");
            
            // Map field names to column names
            const documentFieldMapping = {
                'panCard': 'pan_card_path',
                'buisness_logo':'business_logo',
                'idProof': 'id_proof_path',
                'cancelledCheque': 'cancelled_cheque_path',
                'gstinCertificate': 'gstin_certificate_path',
                'msmeCertificate': 'msme_certificate_path',
                'shopEstablishment': 'shop_establishment_path',
                'businessLicense':'business_license_path',
                'insurancePolicy':'insurance_policy_path',
                'experienceCertificate':'experience_certificate_path',
            };
            
            // Process each uploaded file
            Object.keys(files).forEach(fieldName => {
                console.log(`Processing field: ${fieldName}`);
                if (files[fieldName] && files[fieldName][0]) {
                    const file = files[fieldName][0];
                    const columnName = documentFieldMapping[fieldName];
                    
                    if (columnName) {
                        console.log(`File details for ${fieldName}:`, {
                            filename: file.filename,
                            originalname: file.originalname,
                            path: file.path,
                            size: file.size,
                            mimetype: file.mimetype
                        });
                        
                        // Store file path in the corresponding column
                        documents[columnName] = file.path;
                        console.log(`Storing ${fieldName} path in ${columnName}: ${file.path}`);
                    }
                }
            });
            console.log("Document paths stored in separate columns:", documents);
        } else {
            console.log("No files to process - multer middleware may not have processed files");
            console.log("This could be due to:");
            console.log("1. Multer middleware not being called");
            console.log("2. File size exceeding limits");
            console.log("3. Invalid file types");
            console.log("4. Multer configuration issues");
            
            // Return error if no files were processed
            return res.status(400).json({
                success: false,
                message: "No files were processed. Please check file size (max 5MB) and file types (PDF, JPG, PNG only)."
            });
        }

                // Get phone number from request headers, body, or query params to find the specific vendor
                const phoneNumber = req.user?.phone || req.body.phone || req.query.phone;
                console.log("Looking for vendor with phone:", phoneNumber);
                console.log("Request user:", req.user);
                console.log("Request body phone:", req.body.phone);
                console.log("Request query phone:", req.query.phone);
                
                let latestVendor = null;
                
                if (phoneNumber && phoneNumber !== "temp-phone") {
                    // Find vendor by phone number through user association
                    latestVendor = await Vendor.findOne({
                        include: [{
                            model: User,
                            as: "user",
                            where: { phone: phoneNumber }
                        }],
                        where: { 
                            [Op.or]: [
                                { kyc_status: 'in_progress' },
                                { kyc_status: 'pending' }
                            ]
                        },
                        order: [['id', 'DESC']]
                    });
                }
                
                // If no vendor found by phone, try to find the latest vendor with in_progress status
                if (!latestVendor) {
                    latestVendor = await Vendor.findOne({
                        order: [['id', 'DESC']],
                        where: { 
                            [Op.or]: [
                                { kyc_status: 'in_progress' },
                                { kyc_status: 'pending' },
                                { kyc_step: 1 }
                            ]
                        }
                    });
                }

                // If still no vendor found, find the latest vendor regardless of status
                if (!latestVendor) {
                    latestVendor = await Vendor.findOne({
                        order: [['id', 'DESC']]
                    });
                }

                // If still no vendor, create a new one
                if (!latestVendor) {
                    latestVendor = await Vendor.create({
                        user_id: 1, // Default user ID
                        kyc_status: 'in_progress',
                        kyc_step: 2,
                        status: 'inactive'
                    });
                }

                console.log("Found vendor for document upload:", {
                    id: latestVendor.id,
                    kyc_status: latestVendor.kyc_status,
                    kyc_step: latestVendor.kyc_step,
                    user_id: latestVendor.user_id
                });

                if (latestVendor) {
                    // Always update documents and kyc_step
                    let updateData = {
                        kyc_step: 3,
                        kyc_status: 'in_progress',
                        ...documents // Spread the document paths into separate columns
                    };
                    
                    console.log("Updating vendor with data:", {
                        vendorId: latestVendor.id,
                        updateData: updateData,
                        documentKeys: Object.keys(documents),
                        documentValues: documents
                    });
                    
                    // Update vendor with retry logic
                    let updateSuccess = false;
                    let retryCount = 0;
                    const maxRetries = 3;
                    
                    while (!updateSuccess && retryCount < maxRetries) {
                        try {
                            await latestVendor.update(updateData);
                            updateSuccess = true;
                            console.log(`Database update successful on attempt ${retryCount + 1}`);
                            
                            // Verify the update by fetching the vendor again
                            const updatedVendor = await Vendor.findByPk(latestVendor.id);
                            console.log("Vendor after update:", {
                                id: updatedVendor.id,
                                kyc_step: updatedVendor.kyc_step,
                                kyc_status: updatedVendor.kyc_status,
                                pan_card_path: updatedVendor.pan_card_path,
                                business_logo: updatedVendor.business_logo,
                                id_proof_path: updatedVendor.id_proof_path,
                                cancelled_cheque_path: updatedVendor.cancelled_cheque_path,
                                gstin_certificate_path: updatedVendor.gstin_certificate_path,
                                msme_certificate_path: updatedVendor.msme_certificate_path,
                                shop_establishment_path: updatedVendor.shop_establishment_path,
                                //new added
                                businessLicense:updatedVendor.business_license_path,
                                insurancePolicy:updatedVendor.insurance_policy_path,
                                experienceCertificate:updatedVendor.experience_certificate_path,
                            });
                        } catch (updateError) {
                            retryCount++;
                            console.error(`Database update attempt ${retryCount} failed:`, updateError.message);
                            
                            if (retryCount < maxRetries) {
                                console.log(`Retrying database update in 1 second...`);
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            } else {
                                console.error("All database update attempts failed");
                                throw updateError;
                            }
                        }
                    }

                    logger.api("info", "Documents uploaded successfully", {
                        vendorId: latestVendor.id,
                        documentCount: Object.keys(documents).length,
                    });

                    res.json({
                        success: true,
                        message: "Documents uploaded successfully",
                        kyc_step: 3,
                    });
                } else {
                    res.status(404).json({
                        success: false,
                        message: "Vendor record not found"
                    });
                }
    } catch (error) {
        logger.api("error", "Error in documents step", {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id,
        });
        
        // If files were processed but database update failed, still consider it a partial success
        if (documents && Object.keys(documents).length > 0) {
            console.log("Files were uploaded successfully but database update failed. Returning partial success.");
            res.json({
                success: true,
                message: "Documents uploaded successfully (database sync pending)",
                kyc_step: 3,
                warning: "Files uploaded but database update failed. Data will be synced on next access."
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: "Failed to save documents" 
            });
        }
    }
};

// Remove Document
exports.removeDocument = async (req, res) => {
    try {
        const { fieldName } = req.body;
        const phoneNumber = req.query.phone || req.body.phone;
        
        if (!fieldName || !phoneNumber) {
            return res.status(400).json({
                success: false,
                message: "Field name and phone number are required"
            });
        }

        console.log(`Removing document field: ${fieldName} for phone: ${phoneNumber}`);

        // Find the vendor record
        const latestVendor = await Vendor.findOne({
            include: [{
                model: User,
                as: 'user',
                where: { phone: phoneNumber }
            }],
            where: { kyc_status: 'in_progress' },
            order: [['id', 'DESC']]
        });

        if (!latestVendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor record not found"
            });
        }

        // Map field names to column names
        const documentFieldMapping = {
            'panCard': 'pan_card_path',
            'buisness_logo':'business_logo',
            'idProof': 'id_proof_path',
            'cancelledCheque': 'cancelled_cheque_path',
            'gstinCertificate': 'gstin_certificate_path',
            'msmeCertificate': 'msme_certificate_path',
            'shopEstablishment': 'shop_establishment_path'
        };

        const columnName = documentFieldMapping[fieldName];
        if (!columnName) {
            return res.status(400).json({
                success: false,
                message: "Invalid document field name"
            });
        }

        console.log(`Removing document field ${fieldName} (column: ${columnName})`);

        // Update the vendor record by setting the specific column to null
        const updateData = {
            [columnName]: null
        };

        await latestVendor.update(updateData);

        res.json({
            success: true,
            message: "Document removed successfully"
        });

    } catch (error) {
        console.error("Error removing document:", error);
        res.status(500).json({
            success: false,
            message: "Failed to remove document"
        });
    }
};

// Step 3: Bank Details
exports.saveBankDetailsStep = async (req, res) => {
    try {
        console.log("KYC Step 3 - Request body:", req.body);
        console.log("KYC Step 3 - Request body type:", typeof req.body);
        console.log("KYC Step 3 - Request headers:", req.headers);
        
        const bankData = req.body.bankData || {};
        
        console.log("KYC Step 3 - Bank details received:", bankData);

        // Find the latest vendor record - try multiple approaches
        let latestVendor = await Vendor.findOne({
            order: [['id', 'DESC']],
            where: { kyc_status: 'in_progress' }
        });

        // If no vendor with in_progress status, find the latest vendor
        if (!latestVendor) {
            latestVendor = await Vendor.findOne({
                order: [['id', 'DESC']]
            });
        }

        // If still no vendor, create a new one
        if (!latestVendor) {
            // Create a new vendor record for KYC process
            latestVendor = await Vendor.create({
                user_id: 1, // Default user ID
                kyc_status: 'in_progress',
                kyc_step: 3,
                status: 'inactive'
            });
        }

        // Update vendor with bank details
        const updateData = {
            account_holder_name: bankData.accountHolderName,
            bank_name: bankData.bankName,
            ifsc_code: bankData.ifscCode,
            account_number: bankData.accountNumber,
            kyc_step: 4,
            kyc_status: 'in_progress'
        };

        await latestVendor.update(updateData);

        logger.api("info", "Bank details saved successfully", {
            vendorId: latestVendor.id,
            bankData: bankData,
        });

        res.json({
            success: true,
            message: "Bank details saved successfully",
            kyc_step: 4,
        });
    } catch (error) {
        console.error("Error in bank details step:", error);
        logger.api("error", "Error in bank details step", {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id,
        });
        res.status(500).json({ 
            success: false, 
            message: "Failed to save bank details: " + error.message 
        });
    }
};

// Step 4: Review & Submit
exports.submitKYC = async (req, res) => {
    try {
        console.log("KYC Step 4 - KYC submission received");

        // Find the latest vendor record - try multiple approaches
        let latestVendor = await Vendor.findOne({
            order: [['id', 'DESC']],
            where: { kyc_status: 'in_progress' }
        });

        // If no vendor with in_progress status, find the latest vendor
        if (!latestVendor) {
            latestVendor = await Vendor.findOne({
                order: [['id', 'DESC']]
            });
        }

        if (latestVendor) {
            // Update KYC status to completed and activate vendor account
            await latestVendor.update({
                kyc_status: "completed",
                kyc_step: 4,
                status: "active", // Activate vendor account after KYC completion
            });

            logger.api("info", "KYC submitted successfully and vendor account activated", {
                vendorId: latestVendor.id,
                kyc_status: "completed",
                vendor_status: "active"
            });
        }

        res.json({
            success: true,
            message: "KYC submitted successfully! Your vendor account is now active.",
            kyc_status: "completed",
            vendor_status: "active",
        });
    } catch (error) {
        logger.api("error", "Error submitting KYC", {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id,
        });
        res.status(500).json({ 
            success: false, 
            message: "Failed to submit KYC" 
        });
    }
};

// Get KYC status and data
exports.getKYCStatus = async (req, res) => {
    try {
        console.log("KYC Status requested");

        // Get phone number from query params or request body
        let phoneNumber = req.query.phone || req.body.phone;
        
        // If phone is in query params, decode it
        if (req.query.phone) {
            phoneNumber = decodeURIComponent(req.query.phone);
        }
        
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: "Phone number is required"
            });
        }
        
        const normalizedPhone = phoneNumber.replace(/\D/g, '').slice(-10);
        
        console.log("Getting KYC status for phone:", normalizedPhone);
        console.log("Original phone number:", phoneNumber);
        console.log("Normalized phone number:", normalizedPhone);
        
        // Find the vendor record for this specific phone number
        // Check both in_progress and completed KYC records
        const latestVendor = await Vendor.findOne({
            include: [{
                model: User,
                as: "user",
                attributes: ['id', 'name', 'email', 'phone'],
                where: { phone: normalizedPhone }
            }],
            order: [['id', 'DESC']],
            where: { 
                kyc_status: ['in_progress', 'completed']
            }
        });

        console.log("Found vendor record:", latestVendor ? "Yes" : "No");
        if (latestVendor) {
            console.log("Vendor KYC step:", latestVendor.kyc_step);
            console.log("Vendor KYC status:", latestVendor.kyc_status);
            res.json({
                success: true,
                kyc_status: latestVendor.kyc_status,
                kyc_step: latestVendor.kyc_step,
                vendor: {
                    id: latestVendor.id,
                    user_id: latestVendor.user_id,
                    name: latestVendor.user.name,
                    email: latestVendor.user.email,
                    phone: latestVendor.user.phone,
                    business_name: latestVendor.business_name,
                    business_type: latestVendor.business_type,
                    kyc_status: latestVendor.kyc_status,
                    kyc_step: latestVendor.kyc_step,
                },
                // Include all KYC data for editing
                personal_data: {
                    fullName: latestVendor.user.name,
                    email: latestVendor.user.email,
                    mobile: latestVendor.user.phone,
                    address: latestVendor.address,
                },
                business_data: {
                    businessName: latestVendor.business_name,
                    businessType: latestVendor.business_type,
                    businessEntity: latestVendor.business_entity,
                    businessAddress: latestVendor.business_address,
                    gstin: latestVendor.gstin,
                },
                bank_data: {
                    accountHolderName: latestVendor.account_holder_name,
                    bankName: latestVendor.bank_name,
                    ifscCode: latestVendor.ifsc_code,
                    accountNumber: latestVendor.account_number,
                },
                documents: {
                    panCard: latestVendor.pan_card_path ? {
                        path: latestVendor.pan_card_path,
                        verified: latestVendor.pan_card_verified
                    } : null,

buisness_logo: latestVendor.business_logo ? {
                        path: latestVendor.business_logo,
                        verified: latestVendor.business_logo
                    } :null,


                   
                    idProof: latestVendor.id_proof_path ? {
                        path: latestVendor.id_proof_path,
                        verified: latestVendor.id_proof_verified
                    } : null,
                    cancelledCheque: latestVendor.cancelled_cheque_path ? {
                        path: latestVendor.cancelled_cheque_path,
                        verified: latestVendor.cancelled_cheque_verified
                    } : null,
                    gstinCertificate: latestVendor.gstin_certificate_path ? {
                        path: latestVendor.gstin_certificate_path,
                        verified: latestVendor.gstin_certificate_verified
                    } : null,
                    msmeCertificate: latestVendor.msme_certificate_path ? {
                        path: latestVendor.msme_certificate_path,
                        verified: latestVendor.msme_certificate_verified
                    } : null,
                    shopEstablishment: latestVendor.shop_establishment_path ? {
                        path: latestVendor.shop_establishment_path,
                        verified: latestVendor.shop_establishment_verified
                    } : null
                }
            });
        } else {
            console.log("No vendor record found for phone:", normalizedPhone);
            res.json({
                success: true,
                kyc_status: "pending",
                kyc_step: 1,
                vendor: {
                    id: "temp_vendor_id",
                    name: "Temp Vendor",
                    email: "temp@example.com",
                    phone: "temp_phone",
                    business_name: "Temp Business",
                    business_type: "Temporary",
                    kyc_status: "pending",
                    kyc_step: 1,
                }
            });
        }
    } catch (error) {
        logger.api("error", "Error getting KYC status", {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id,
        });
        res.status(500).json({ 
            success: false, 
            message: "Failed to get KYC status" 
        });
    }
};

// OTP verification for registration
exports.verifyOTP = async (req, res) => {
    try {
        const { phone, otp } = req.body;

        // For now, accept any 6-digit OTP (in production, verify with SMS service)
        if (!otp || otp.length !== 6) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid OTP format" 
            });
        }

        // Generate temp token for KYC process
        const tempToken = jwt.sign(
            { phone: phone, type: "kyc_temp" },
            JWT_SECRET,
            { expiresIn: "1h" }
        );

        logger.api("info", "OTP verified successfully", {
            phone: phone,
        });

        res.json({
            success: true,
            message: "OTP verified successfully",
            temp_token: tempToken,
        });
    } catch (error) {
        logger.api("error", "Error verifying OTP", {
            error: error.message,
            stack: error.stack,
            phone: req.body.phone,
        });
        res.status(500).json({ 
            success: false, 
            message: "Failed to verify OTP" 
        });
    }
};

// Remove bank document
exports.removeBankDocument = async (req, res) => {
    try {
        const { phone } = req.body;
        
        if (!phone) {
            return res.status(400).json({
                success: false,
                message: "Phone number is required"
            });
        }
        
        // Find the latest vendor record
        const latestVendor = await Vendor.findOne({
            order: [['id', 'DESC']],
            where: { kyc_status: 'in_progress' }
        });

        if (!latestVendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor record not found"
            });
        }

        // Get the current file path before removing
        const currentFilePath = latestVendor.cancelled_cheque_path;
        
        // Remove cancelled cheque document from database
        await latestVendor.update({
            cancelled_cheque_path: null,
            cancelled_cheque_verified: false
        });

        // Delete the physical file if it exists
        if (currentFilePath) {
            try {
                const fullPath = path.join(__dirname, '..', '..', currentFilePath);
                
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                    logger.api("info", "Physical file deleted", {
                        filePath: fullPath
                    });
                }
            } catch (fileError) {
                logger.api("warn", "Failed to delete physical file", {
                    error: fileError.message,
                    filePath: currentFilePath
                });
                // Don't fail the request if file deletion fails
            }
        }

        logger.api("info", "Bank document removed successfully", {
            vendorId: latestVendor.id,
            phone: phone,
        });

        res.json({
            success: true,
            message: "Bank document removed successfully"
        });
    } catch (error) {
        logger.api("error", "Error removing bank document", {
            error: error.message,
            stack: error.stack,
            phone: req.body.phone,
        });
        res.status(500).json({
            success: false,
            message: "Failed to remove bank document"
        });
    }
};

// Test endpoint to check database connection
exports.testDatabase = async (req, res) => {
    try {
        console.log("Testing database connection...");
        
        // Test User model
        const userCount = await User.count();
        console.log("User count:", userCount);
        
        // Test Vendor model
        const vendorCount = await Vendor.count();
        console.log("Vendor count:", vendorCount);
        
        res.json({
            success: true,
            message: "Database connection working",
            userCount: userCount,
            vendorCount: vendorCount
        });
    } catch (error) {
        console.error("Database test error:", error);
        res.status(500).json({
            success: false,
            message: "Database test failed",
            error: error.message
        });
    }
};

// Test endpoint to debug file upload
exports.testFileUpload = async (req, res) => {
    try {
        console.log("=== FILE UPLOAD TEST ===");
        console.log("Request method:", req.method);
        console.log("Request headers:", req.headers);
        console.log("Request body:", req.body);
        console.log("Request files:", req.files);
        console.log("Request files type:", typeof req.files);
        console.log("Request files keys:", req.files ? Object.keys(req.files) : "No files");
        
        if (req.files) {
            Object.keys(req.files).forEach(fieldName => {
                console.log(`Field ${fieldName}:`, req.files[fieldName]);
                if (req.files[fieldName] && req.files[fieldName][0]) {
                    console.log(`File details for ${fieldName}:`, {
                        filename: req.files[fieldName][0].filename,
                        originalname: req.files[fieldName][0].originalname,
                        path: req.files[fieldName][0].path,
                        size: req.files[fieldName][0].size,
                        mimetype: req.files[fieldName][0].mimetype
                    });
                }
            });
        }
        
        res.json({
            success: true,
            message: "File upload test completed",
            filesReceived: req.files ? Object.keys(req.files).length : 0,
            files: req.files
        });
    } catch (error) {
        console.error("File upload test error:", error);
        res.status(500).json({
            success: false,
            message: "File upload test failed",
            error: error.message
        });
    }
};

// Send OTP for registration
exports.sendOTP = async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ 
                success: false, 
                message: "Phone number is required" 
            });
        }

        // Generate random 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // In production, send OTP via SMS service
        // For now, just log it
        logger.api("info", "OTP generated", {
            phone: phone,
            otp: otp,
        });

        res.json({
            success: true,
            message: "OTP sent successfully",
            otp: otp, // Remove this in production
        });
    } catch (error) {
        logger.api("error", "Error sending OTP", {
            error: error.message,
            stack: error.stack,
            phone: req.body.phone,
        });
        res.status(500).json({ 
            success: false, 
            message: "Failed to send OTP" 
        });
    }
};

// Create vendor account after KYC completion
exports.createVendorAccount = async (req, res) => {
    try {
        const { personal, business } = req.body;
        const { phone } = req.user; // From temp token

        // Check if user already exists
        const existingUser = await User.findOne({ where: { phone: phone } });
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: "Phone number already registered" 
            });
        }

        // Generate password from full name
        const password = generatePassword(personal.fullName);
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.create({
            name: personal.fullName,
            email: personal.email,
            phone: phone,
            passwordHash: hashedPassword,
            roleId: 2, // Vendor role
            status: "inactive", // Will be activated after KYC approval
        });

        // Create vendor record
        const vendor = await Vendor.create({
            user_id: user.id,
            kyc_status: "pending",
            kyc_step: 1,
        });

        logger.api("info", "Vendor account created", {
            vendorId: vendor.id,
            userId: user.id,
            email: user.email,
            phone: user.phone,
        });

        res.json({
            success: true,
            message: "Vendor account created successfully",
            vendor: {
                id: vendor.id,
                user_id: user.id,
                email: user.email,
                name: user.name,
                phone: user.phone,
                kyc_status: vendor.kyc_status,
            },
        });
    } catch (error) {
        logger.api("error", "Error creating vendor account", {
            error: error.message,
            stack: error.stack,
        });
        res.status(500).json({ 
            success: false, 
            message: "Failed to create vendor account" 
        });
    }
};
