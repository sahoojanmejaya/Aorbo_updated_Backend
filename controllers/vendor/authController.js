const { Vendor, TrekAuditLog, User, UserOtp, Role, VendorActivityLogs } = require("../../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const logger = require("../../utils/logger");
const multer = require("multer");
const path = require("path");
const { uploadToCloudinary } = require("../../utils/cloudinary");
const { Op } = require("sequelize");
const addVendorLog = require("../../services/vendorActivityLogger");


const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("FATAL: JWT_SECRET environment variable is not set");

// Vendor registration
exports.register = async (req, res) => {
    try {
        const { email, password, name, company_info } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res
                .status(400)
                .json({ message: "Email already registered" });
        }

        // Check if user is already a vendor
        if (existingUser) {
            const existingVendor = await Vendor.findOne({
                where: { user_id: existingUser.id },
            });
            if (existingVendor) {
                return res
                    .status(400)
                    .json({ message: "User is already a vendor" });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user first
        const user = await User.create({
            name,
            email,
            passwordHash: hashedPassword,
            roleId: 2, // Assuming 2 is vendor role
            status: "active",
        });

        // Create vendor record
        const vendor = await Vendor.create({
            user_id: user.id,
            company_info: company_info || {},
            status: "active",
        });

        logger.auth("info", "Vendor registered successfully", {
            vendorId: vendor.id,
            userId: user.id,
            email: user.email,
        });

        return res.status(201).json({
            message: "Vendor registered successfully",
            vendor: {
                id: vendor.id,
                user_id: user.id,
                email: user.email,
                name: user.name,
                company_info: vendor.company_info,
                status: vendor.status,
            },
        });
    } catch (err) {
        logger.auth("error", "Vendor registration failed", {
            error: err.message,
            stack: err.stack,
            email: req.body.email,
        });
        res.status(500).json({ message: "Registration failed" });
    }
};

// Vendor login


exports.checkEmailAndProceed = async (req, res) => {
    try {
        const { email } = req.body;

        // email required validation
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        // check email exist
        const existingUser = await User.findOne({ where: { email } });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Email already registered",
                exists: true
            });
        }

        // email not exist -> continue process
        return res.status(200).json({
            success: true,
            message: "Email available, you can proceed",
            exists: false,
            email: email
        });

        // 👉 yaha se aap user create ya next step ka logic likh sakte ho

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

exports.login_old = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res
                .status(400)
                .json({ message: "Email and password required" });
        }

        // Find user by email
        const user = await User.findOne({ where: { email } });
        if (!user) {
            logger.auth("warn", "Login attempt with invalid email", {
                email: email,
                ip: req.ip,
            });
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Check if user is a vendor using raw query to avoid model issues
        const { sequelize } = require("../../models");
        const [vendorResults] = await sequelize.query(
            "SELECT id, user_id, company_info, status FROM vendors WHERE user_id = ?",
            { replacements: [user.id] }
        );

        if (vendorResults.length === 0) {
            logger.auth("warn", "Login attempt by non-vendor user", {
                email: email,
                userId: user.id,
                ip: req.ip,
            });
            return res.status(401).json({ message: "User is not a vendor" });
        }

        const vendor = vendorResults[0];

        // Verify password
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            logger.auth("warn", "Login attempt with invalid password", {
                email: email,
                userId: user.id,
                ip: req.ip,
            });
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Check if vendor is active
        if (vendor.status !== "active") {
            logger.auth("warn", "Login attempt by inactive vendor", {
                email: email,
                vendorId: vendor.id,
                status: vendor.status,
                ip: req.ip,
            });
            return res
                .status(401)
                .json({ message: "Vendor account is not active" });
        }

        const token = jwt.sign(
            {
                id: vendor.id,
                user_id: user.id,
                email: user.email,
                role: "vendor",
            },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        logger.auth("info", "Vendor login successful", {
            vendorId: vendor.id,
            userId: user.id,
            email: user.email,
            ip: req.ip,
        });

        res.json({
            token,
            vendor: {
                id: vendor.id,
                user_id: user.id,
                email: user.email,
                name: user.name,
                company_info: vendor.company_info ? JSON.parse(vendor.company_info) : {},
                status: vendor.status,
            },
        });
    } catch (err) {
        logger.auth("error", "Vendor login failed", {
            error: err.message,
            stack: err.stack,
            email: req.body.email,
            ip: req.ip,
        });
        res.status(500).json({ message: "Login failed" });
    }
};

exports.sendOtp = async (req, res) => {
    try {
        const { mobile } = req.body;

        if (!mobile) {
            return res.status(400).json({
                status: false,
                message: "Mobile number required"
            });
        }

        // =========================
        // HELPER (same file)
        // =========================
        const getResendDelay = (count) => {
            switch (count) {
                case 0: return 0;                        // first send immediate
                case 1: return 1 * 60 * 1000;            // 1 minute
                case 2: return 5 * 60 * 1000;            // 5 minutes
                case 3: return 60 * 60 * 1000;           // 1 hour
                case 4: return 24 * 60 * 60 * 1000;      // 1 day
                default: return null;                    // block after 5 sends
            }
        };

        // =========================
        // Check resend history
        // =========================
        const otpHistory = await UserOtp.findAll({
            where: { mobile },
            order: [["created_at", "DESC"]]
        });

        const resendCount = otpHistory.length;
        const delay = getResendDelay(resendCount);

        // block
        if (delay === null) {
            return res.status(403).json({
                status: false,
                message: "Maximum OTP resend limit reached. Try later."
            });
        }

        // time check
        if (otpHistory.length > 0) {
            const lastSent = new Date(otpHistory[0].created_at).getTime();
            const now = Date.now();
            const diff = now - lastSent;

            if (diff < delay) {
                const remainingSeconds = Math.ceil((delay - diff) / 1000);

                return res.status(429).json({
                    status: false,
                    message: "Please wait  min before requesting OTP again",
                    wait_seconds: remainingSeconds
                });
            }
        }

        // =========================
        // Check user
        // =========================
        const user = await User.findOne({ where: { phone: mobile } });

        // =========================
        // Generate OTP
        // =========================
        const otp = Math.floor(100000 + Math.random() * 900000);
        const expiry = new Date(Date.now() + 5 * 60 * 1000);

        // expire old pending OTP
        await UserOtp.update(
            { status: "EXPIRED" },
            { where: { mobile, status: "PENDING" } }
        );

        // =========================
        // Save new OTP
        // =========================
        await UserOtp.create({
            user_id: user ? user.id : 0,
            mobile,
            otp_code: otp,
            expires_at: expiry
        });

        // TODO send SMS
        console.log("OTP:", otp);

        return res.json({
            status: true,
            message: user ? "OTP sent for login" : "OTP sent for onboarding",
            is_registered: !!user,
            resend_count: resendCount + 1,
            otp_code: otp // remove in production
        });

    } catch (err) {
        console.error("Send OTP error:", err);
        return res.status(500).json({
            status: false,
            message: "Failed to send OTP"
        });
    }
};



exports.sendOtpOLD = async (req, res) => {
    //try {
    const { mobile } = req.body;

    if (!mobile) {
        return res.status(400).json({
            status: false,
            message: "Mobile number required"
        });
    }

    // 🔍 Check user
    const user = await User.findOne({ where: { phone: mobile } });

    // 🔢 Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 min

    // ⛔ Expire old OTPs
    await UserOtp.update(
        { status: "EXPIRED" },
        { where: { mobile, status: "PENDING" } }
    );

    // 💾 Save OTP
    await UserOtp.create({
        user_id: user ? user.id : 0, // 👈 null if new user
        mobile,
        otp_code: otp,
        expires_at: expiry,
        purpose: user ? "LOGIN" : "ONBOARD"
    });

    // 📩 Send OTP (SMS API)
    // await sendOtpToMobile(mobile, otp);

    return res.json({
        status: true,
        message: user
            ? "OTP sent for login"
            : "OTP sent for onboarding",
        is_registered: !!user, // 👈 frontend ke kaam aayega
        otp_code: otp // ⚠️ prod me hata dena
    });

    /* } catch (err) {
         console.error("Send OTP error:", err);
         return res.status(500).json({
             status: false,
             message: "Failed to send OTP"
         });
     }*/
};


exports.verifyOtpOLD = async (req, res) => {
    //try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
        return res.status(400).json({
            status: false,
            message: "Mobile and OTP required",
        });
    }



    /* =========================
       1️⃣ VERIFY OTP
    ==========================*/
    const otpRecord = await UserOtp.findOne({
        where: {
            mobile,
            otp_code: otp,
            status: "PENDING",
        },
        order: [["created_at", "DESC"]],
    });

    if (!otpRecord) {
        return res.status(401).json({
            status: false,
            message: "Invalid OTP",
        });
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
        await otpRecord.update({ status: "EXPIRED" });
        return res.status(401).json({
            status: false,
            message: "OTP expired",
        });
    }

    await otpRecord.update({ status: "VERIFIED" });


    const rawMobile = mobile.toString().trim();

    // +91 version
    const mobileWithCode = rawMobile.startsWith("+91")
        ? rawMobile
        : "+91" + rawMobile.replace(/^0+/, "");

    // without +91 version
    const mobileWithoutCode = rawMobile.replace(/^\+91/, "").replace(/^0+/, "");

    const user = await User.findOne({
        where: {
            [Op.or]: [
                { phone: mobileWithCode },
                { phone: mobileWithoutCode }
            ]
        }
    });


    // 3️⃣ Check vendor table with user_id
    const vendorlist = await Vendor.findOne({
        where: { user_id: user.id }
    });

    // 🔥 CASE 1: USER NOT FOUND → ONBOARDING
    if (!user) {
        return res.json({
            status: true,
            flow: "ONBOARD",
            message: "OTP verified. Continue onboarding.",
            token: null,
            user: null,
            vendor: null,
        });
    }

    /* =========================
       3️⃣ FETCH VENDOR
    ==========================*/
    const { sequelize } = require("../../models");
    const [vendorResults] = await sequelize.query(
        `SELECT id, user_id, company_info, status, kyc_status, application_status
             FROM vendors
             WHERE user_id = ?`,
        { replacements: [vendorlist.user_id] }
    );

    // 🔥 CASE 2: USER EXISTS BUT NOT VENDOR
    if (!vendorResults.length) {
        return res.json({
            status: true,
            flow: "USER_ONLY",
            message: "OTP verified. User is not a vendor.",
            token: null,
            user: {
                id: vendorlist.user_id,
                name: user.name,
                email: user.email,
                mobile,
            },
            vendor: null,
        });
    }

    const vendor = vendorResults[0];

    /* =========================
       4️⃣ APPLICATION STATUS CHECK
    ==========================*/
    if (vendor.application_status === "NEW") {
        return res.status(200).json({
            status: false,
            flow: "VENDOR_PENDING",
            message: "Your application is under review.",
        });
    }

    if (vendor.application_status === "REJECTED") {
        return res.status(403).json({
            status: false,
            flow: "VENDOR_REJECTED",
            message: "Your vendor application has been rejected.",
        });
    }

    /* =========================
       5️⃣ VENDOR ACTIVE CHECK
    ==========================*/
    if (vendor.status !== "active") {
        return res.status(403).json({
            status: false,
            flow: "VENDOR_INACTIVE",
            message: "Vendor account is not active",
        });
    }

    /* =========================
       6️⃣ GENERATE JWT
    ==========================*/
    const token = jwt.sign(
        {
            id: vendor.id,
            user_id: user.id,
            role: "vendor",
        },
        JWT_SECRET,
        { expiresIn: "7d" }
    );

    /* =========================
       7️⃣ SUCCESS (LOGIN)
    ==========================*/
    return res.json({
        status: true,
        flow: "LOGIN",
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            mobile,
        },
        vendor: {
            id: user.id,
            name: user.name,
            email: user.email,
            mobile,
            id: vendor.id,
            company_info: vendor.company_info
                ? JSON.parse(vendor.company_info)
                : {},
            status: vendor.status,
            application_status: vendor.application_status,
            kyc_status: vendor.kyc_status,
        },
    });

    /*  } catch (error) {
          console.error("OTP verify failed:", error);
          return res.status(500).json({
              status: false,
              message: "OTP verification failed",
          });
      }*/
};


exports.verifyOtp = async (req, res) => {
    try {
        let { mobile, otp } = req.body;

        if (!mobile || !otp) {
            return res.status(400).json({
                status: false,
                message: "Mobile and OTP required",
            });
        }

        /* =========================
           NORMALIZE MOBILE
        ==========================*/
        const rawMobile = mobile.toString().trim();

        const mobileWithCode = rawMobile.startsWith("+91")
            ? rawMobile
            : "+91" + rawMobile.replace(/^0+/, "");

        const mobileWithoutCode = rawMobile
            .replace(/^\+91/, "")
            .replace(/^0+/, "");

        /* =========================
           1️⃣ VERIFY OTP
        ==========================*/
        const otpRecord = await UserOtp.findOne({
            where: {
                [Op.or]: [
                    { mobile: mobileWithCode },
                    { mobile: mobileWithoutCode }
                ],
                otp_code: otp,
                status: "PENDING",
            },
            order: [["created_at", "DESC"]],
        });

        if (!otpRecord) {
            return res.status(401).json({
                status: false,
                message: "Invalid OTP",
            });
        }

        if (new Date(otpRecord.expires_at) < new Date()) {
            await otpRecord.update({ status: "EXPIRED" });
            return res.status(401).json({
                status: false,
                message: "OTP expired",
            });
        }

        await otpRecord.update({ status: "VERIFIED" });

        /* =========================
           2️⃣ FIND USER
        ==========================*/
        const user = await User.findOne({
            where: {
                [Op.or]: [
                    { phone: mobileWithCode },
                    { phone: mobileWithoutCode }
                ]
            }
        });

        // USER NOT FOUND → ONBOARD
        if (!user) {
            return res.json({
                status: true,
                flow: "ONBOARD",
                message: "OTP verified. Continue onboarding.",
                token: null,
                user: null,
                vendor: null,
            });
        }

        /* =========================
           3️⃣ FIND VENDOR
        ==========================*/
        const vendor = await Vendor.findOne({
            where: { user_id: user.id }
        });

        // USER EXISTS BUT NOT VENDOR
        if (!vendor) {
            return res.json({
                status: true,
                flow: "USER_ONLY",
                message: "OTP verified. User is not a vendor.",
                token: null,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    mobile: user.phone,
                },
                vendor: null,
            });
        }

        /* =========================
           4️⃣ APPLICATION STATUS
        ==========================*/
        if (vendor.application_status === "NEW") {
            return res.status(200).json({
                status: false,
                flow: "VENDOR_PENDING",
                message: "Your application is under review.",
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    mobile: user.phone,
                },
                vendor: {
                    id: vendor.id,
                    company_info: vendor.company_info
                        ? JSON.parse(vendor.company_info)
                        : {},
                    status: vendor.status,
                    application_status: vendor.application_status,
                    kyc_status: vendor.kyc_status,
                },
            });
        }

        if (vendor.application_status === "REJECTED") {
            return res.status(403).json({
                status: false,
                flow: "VENDOR_REJECTED",
                message: "Your vendor application has been rejected.",
            });
        }

        /* =========================
           5️⃣ ACTIVE CHECK
        ==========================*/
        if (vendor.status !== "active") {
            return res.status(403).json({
                status: false,
                flow: "VENDOR_INACTIVE",
                message: "Vendor account is not active",
            });
        }

        /* =========================
           6️⃣ GENERATE TOKEN
        ==========================*/
        const token = jwt.sign(
            {
                id: vendor.id,
                user_id: user.id,
                role: "vendor",
            },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        /* =========================
           7️⃣ SUCCESS LOGIN
        ==========================*/
        return res.json({
            status: true,
            flow: "LOGIN",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                mobile: user.phone,
            },
            vendor: {
                id: vendor.id,
                company_info: vendor.company_info
                    ? JSON.parse(vendor.company_info)
                    : {},
                status: vendor.status,
                application_status: vendor.application_status,
                kyc_status: vendor.kyc_status,
            },
        });

    } catch (error) {
        console.error("OTP verify failed:", error);
        return res.status(500).json({
            status: false,
            message: "OTP verification failed",
        });
    }
};



// Configure multer — memory storage, then upload to Cloudinary
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) return cb(null, true);
        cb(new Error("Only images (JPEG, PNG, WebP) and PDF files are allowed"));
    },
});

const _uploadFilesToCloudinary = async (req) => {
    if (!req.files) return;
    await Promise.all(
        Object.keys(req.files).map(async (fieldName) => {
            await Promise.all(req.files[fieldName].map(async (file) => {
                const isPdf = file.mimetype === 'application/pdf';
                const result = await uploadToCloudinary(file.buffer, {
                    folder: 'aorbo/kyc-documents',
                    resource_type: isPdf ? 'raw' : 'image',
                });
                file.path = result.secure_url;
                file.public_id = result.public_id;
                console.log(`✅ KYC doc uploaded [${fieldName}]: ${result.secure_url}`);
            }));
        })
    );
};

// Multer middleware for document uploads
const uploadDocuments = (req, res, next) => {
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
    ])(req, res, async (err) => {
        if (err) {
            console.error("Multer error:", err);
            return res.status(400).json({ success: false, message: err.message });
        }
        try {
            await _uploadFilesToCloudinary(req);
            next();
        } catch (uploadErr) {
            console.error("Cloudinary upload error:", uploadErr);
            return res.status(500).json({ success: false, message: 'Document upload failed' });
        }
    });
};
// Get admin profile (with full vendor data)
exports.getProfile = async (req, res) => {
    //try {
    const userId = req.body.user_id;

    const user = await User.findByPk(userId, {
        include: [
            {
                model: Role,
                as: "role",
                attributes: ["id", "name"]
            },
            {
                model: Vendor,
                as: "vendor",
                required: false // LEFT JOIN
                // ❌ attributes mat do => all columns aa jayenge
            }
        ],
        attributes: { exclude: ["passwordHash"] },
    });

    if (!user) {
        return res.status(404).json({
            success: false,
            message: "User not found",
        });
    }

    res.json({
        success: true,
        data: {
            ...user.toJSON(), // user + role
            role: user.role?.name || "admin" // clean role name
        }
    });

    /*} catch (error) {
        console.error("Get admin profile error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get profile",
        });
    }*/
};

exports.updateProfile = async (req, res) => {
    // try {
    const {
        user_id,
        city,
        state,
        pincode,
        adhar_no,
        pan_no,
        dob,
        gender,

        name,
        email,
        phone,

        business_name,
        business_entityname,
        business_address,
        gstin,
        status,
        application_status,
        kyc_status,
        status_reason,
        remark,
        specialties,
        certifications,

        // BANK
        account_holder_name,
        bank_name,
        ifsc_code,
        account_number
    } = req.body;

    if (!user_id) {
        return res.status(400).json({ message: "user_id required" });
    }

    const vendor = await Vendor.findOne({ where: { user_id } });
    if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
    }

    /* ================= USER UPDATE ================= */
    await User.update(
        { name, email, phone },
        { where: { id: user_id } }
    );

    /* ================= FILE MAPPING ================= */
    const files = {};

    if (req.files?.panCard) files.pan_card_path = req.files.panCard[0].path;
    if (req.files?.buisness_logo) files.business_logo = req.files.buisness_logo[0].path;
    if (req.files?.gstinCertificate) files.gstin_certificate_path = req.files.gstinCertificate[0].path;
    if (req.files?.msmeCertificate) files.msme_certificate_path = req.files.msmeCertificate[0].path;
    if (req.files?.shopEstablishment) files.shop_establishment_path = req.files.shopEstablishment[0].path;
    if (req.files?.cancelledCheque) files.cancelled_cheque_path = req.files.cancelledCheque[0].path;
    if (req.files?.id_proof_path) files.id_proof_path = req.files.id_proof_path[0].path;

    /* ✅ newly added fields */
    if (req.files?.businessLicense) files.business_license_path = req.files.businessLicense[0].path;
    if (req.files?.insurancePolicy) files.insurance_policy_path = req.files.insurancePolicy[0].path;
    if (req.files?.experienceCertificate) files.experience_certificate_path = req.files.experienceCertificate[0].path;
    /* ================= VENDOR UPDATE ================= */
    await Vendor.update(
        {
            business_name,
            business_entityname,
            business_address,
            //  business_description,
            status,
            city,
            state,
            pincode,

            // website,
            application_status,
            kyc_status,
            status_reason,
            remark,
            gstin,
            adhar_no,
            pan_no,
            dob,
            gender,

            //  experience_years,
            certifications,
            specialties,
            account_holder_name,
            bank_name,
            ifsc_code,
            account_number,

            ...files,

            // important — tumne bola miss hua tha
            kyc_step: Math.max(vendor.kyc_step, 4)
        },
        { where: { user_id } }
    );

    return res.json({
        success: true,
        message: "User + Vendor profile updated successfully"
    });

    /* } catch (error) {
         console.error(error);
         res.status(500).json({ message: "Internal Server Error" });
     }*/
};


exports.addVendorActivityLog = async (req, res) => {
    try {
        const {
            vendor_id,
            performed_by,
            action,
            reason,
            details,
            status
        } = req.body;

        if (!vendor_id) {
            return res.status(400).json({
                success: false,
                message: "Vendor id required"
            });
        }

        const log = await VendorActivityLogs.create({
            vendor_id,
            performed_datetime: new Date(),
            performed_by,
            action,
            reason,
            details,
            status
        });

        return res.status(201).json({
            success: true,
            message: "Activity log added",
            data: log
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


exports.getVendorActivityLogs = async (req, res) => {
    try {
        const { vendor_id } = req.params;

        if (!vendor_id) {
            return res.status(400).json({
                success: false,
                message: "Vendor id required"
            });
        }

        const logs = await VendorActivityLogs.findAll({
            where: { vendor_id },
            order: [["id", "DESC"]]
        });

        return res.status(200).json({
            success: true,
            data: logs
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};




exports.updateNote = async (req, res) => {
    try {
        const { vendor_id, notes } = req.body;

        // validation
        if (!vendor_id) {
            return res.status(400).json({
                success: false,
                message: "Vendor id is required"
            });
        }

        // update vendor note
        const [updatedRows] = await Vendor.update(
            { notes },
            { where: { user_id: vendor_id } }
        );


        // ⭐ LOG CALL
        await addVendorLog({
            vendor_id,
            performed_by: req.user?.name || "Admin",
            action: "Vendor Updated",
            reason: "Notes change",
            details: notes
        });

        // check updated or not
        if (updatedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Vendor not found or note not updated"
            });
        }



        return res.status(200).json({
            success: true,
            message: "Vendor note updated successfully"
        });




    } catch (error) {
        console.error("Update note error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};



exports.changeUserStatus = async (req, res) => {
    try {
        const { user_id, status, suspended_time, suspended_reason } = req.body;

        // =========================
        // validation
        // =========================
        if (!user_id) {
            return res.status(400).json({
                success: false,
                message: "Vendor id is required"
            });
        }

        if (!status) {
            return res.status(400).json({
                success: false,
                message: "Status is required"
            });
        }

        // optional allowed status validation
        const allowedStatus = ["active", "ban", "suspended"];
        if (!allowedStatus.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status value"
            });
        }

        // =========================
        // update status
        // =========================
        const [updatedRows] = await Vendor.update(
            { status, suspended_time, suspended_reason },
            { where: { user_id: user_id } }
        );

        if (updatedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found or status not updated"
            });
        }

        // =========================
        // log entry
        // =========================
        await addVendorLog({
            vendor_id: user_id,
            performed_by: req.user?.name || "Admin",
            action: "User Status Updated",
            reason: `Status changed to ${status}`,
            details: status
        });

        return res.status(200).json({
            success: true,
            message: `User status updated to ${status}`
        });

    } catch (error) {
        console.error("Change status error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1️⃣ Basic validation
        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password required",
            });
        }

        // 2️⃣ Find user by email
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({
                message: "Invalid credentials",
            });
        }

        // 3️⃣ Fetch vendor (raw query)
        const { sequelize } = require("../../models");
        const [vendorResults] = await sequelize.query(
            `SELECT id, user_id, company_info, status,kyc_status, application_status
             FROM vendors
             WHERE user_id = ?`,
            { replacements: [user.id] }
        );

        if (vendorResults.length === 0) {
            return res.status(401).json({
                message: "User is not a vendor",
            });
        }

        const vendor = vendorResults[0];

        // 4️⃣ Verify password
        const isValidPassword = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!isValidPassword) {
            return res.status(401).json({
                message: "Invalid credentials",
            });
        }

        // 5️⃣ Application status check
        if (vendor.application_status === "NEW") {
            return res.status(403).json({
                message: "Your application is under review.",
                status: "new",
            });
        }

        if (vendor.application_status === "REJECTED") {
            return res.status(403).json({
                message: "Your vendor application has been rejected.",
                status: "rejected",
            });
        }

        // 6️⃣ Vendor active check
        if (vendor.status !== "active") {
            return res.status(403).json({
                message: "Vendor account is not active",
            });
        }

        // 7️⃣ Generate JWT token
        const token = jwt.sign(
            {
                id: vendor.id,
                user_id: user.id,
                email: user.email,
                role: "vendor",
            },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        // 8️⃣ Success response
        return res.json({
            token,
            vendor: {
                id: vendor.id,
                user_id: user.id,
                //  application_status:user.application_status,
                //  kyc_status:user.kyc_status,
                name: user.name,
                email: user.email,
                company_info: vendor.company_info
                    ? JSON.parse(vendor.company_info)
                    : {},
                status: vendor.status,
                application_status: vendor.application_status,
                kyc_status: vendor.kyc_status,

            },
        });
    } catch (error) {
        console.error("Vendor login failed:", error);
        return res.status(500).json({
            message: "Login failed. Please try again later.",
        });
    }
};

// Export multer middleware functions
const getResendDelay = (count) => {
    switch (count) {
        case 0:
            return 0; // first resend immediate
        case 1:
            return 5 * 60 * 1000; // 5 minutes
        case 2:
            return 60 * 60 * 1000; // 1 hour
        case 3:
            return 24 * 60 * 60 * 1000; // 1 day
        default:
            return null; // block
    }
};


//reesend otp
exports.resendOtp = async (req, res) => {

    const { mobile } = req.body;

    if (!mobile) {
        return res.status(400).json({
            message: "Mobile number required",
        });
    }

    const { sequelize } = require("../../models");

    // ============================
    // HELPER (same file)
    // ============================
    const getResendDelay = (count) => {
        switch (count) {
            case 0: return 0;                        // first send immediate
            case 1: return 1 * 60 * 1000;            // 1 minute
            case 2: return 5 * 60 * 1000;            // 5 minutes
            case 3: return 60 * 60 * 1000;           // 1 hour
            case 4: return 24 * 60 * 60 * 1000;      // 1 day
            default: return null;                    // block after 5 sends
        }
    };

    // ============================
    // fetch resend history
    // ============================
    const [otpHistory] = await sequelize.query(`
            SELECT created_at
            FROM user_otps
            WHERE mobile = ?
            ORDER BY created_at DESC
        `, {
        replacements: [mobile]
    });

    const resendCount = otpHistory.length;
    const delay = getResendDelay(resendCount);

    // block after 4 resends
    if (delay === null) {
        return res.status(403).json({
            message: "Maximum resend limit reached. Try again later.",
        });
    }

    // ============================
    // time check
    // ============================
    if (otpHistory.length > 0) {
        const lastSentTime = new Date(otpHistory[0].created_at).getTime();
        const now = Date.now();
        const diff = now - lastSentTime;

        if (diff < delay) {
            const remainingSeconds = Math.ceil((delay - diff) / 1000);

            return res.status(429).json({
                message: "Please wait before requesting OTP again",
                wait_seconds: remainingSeconds,
            });
        }
    }

    // ============================
    // generate OTP
    // ============================
    const otp = Math.floor(100000 + Math.random() * 900000);

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry

    // ============================
    // insert new OTP row
    // ============================
    await sequelize.query(`
            INSERT INTO user_otps (mobile, otp_code, status, created_at, expires_at)
            VALUES (?, ?, 'PENDING', NOW(), ?)
        `, {
        replacements: [mobile, otp, expiresAt]
    });

    // TODO send SMS
    console.log("OTP:", otp);

    return res.json({
        message: "OTP sent successfully",
        otp_code: otp,
        resend_count: resendCount + 1
    });


};



exports.uploadDocuments = uploadDocuments;