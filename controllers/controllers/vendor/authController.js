const { Vendor, TrekAuditLog, User, UserOtp, Role, VendorActivityLogs } = require("../../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const logger = require("../../utils/logger");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { Op } = require("sequelize");
const addVendorLog = require("../../services/vendorActivityLogger");


// BUG #4 FIX: Removed hardcoded JWT_SECRET fallback — if env var is missing, fail fast at startup
if (!process.env.JWT_SECRET) {
    throw new Error("FATAL: JWT_SECRET environment variable is not set. Set it in your .env file before starting the server.");
}
const JWT_SECRET = process.env.JWT_SECRET;

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
        // FIX: More robust rate limit — cleanup runs first, then count only matters within 24h window
        const getResendDelay = (count) => {
            switch (count) {
                case 0: return 0;                        // first OTP: immediate
                case 1: return 60 * 1000;               // 2nd: 1 minute wait
                case 2: return 5 * 60 * 1000;           // 3rd: 5 minutes wait
                case 3: return 60 * 60 * 1000;          // 4th: 1 hour wait
                case 4: return 24 * 60 * 60 * 1000;     // 5th: 24 hour wait
                default: return 24 * 60 * 60 * 1000;    // 6th+: also 24 hour wait (not null/blocked forever)
            }
        };

        // =========================
        // Check resend history
        // =========================
        // BUG #1 FIX: Cleanup OTP rows older than 24 hours so old test/dev records don't permanently block users
        await UserOtp.destroy({
            where: {
                mobile,
                created_at: { [Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }
        });

        // BUG #1 FIX: Count only OTP rows from the last 24 hours — not all historical rows
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const otpHistory = await UserOtp.findAll({
            where: {
                mobile,
                created_at: { [Op.gte]: since }
            },
            order: [["created_at", "DESC"]]
        });

        const resendCount = otpHistory.length;
        const delay = getResendDelay(resendCount);

        // FIX: Never return null/blocked-forever — always return a wait time
        // If delay > 0 and last OTP was sent within that delay window, return 429
        if (otpHistory.length > 0) {
            const lastSent = new Date(otpHistory[0].created_at).getTime();
            const now = Date.now();
            const diff = now - lastSent;

            if (diff < delay) {
                const remainingSeconds = Math.ceil((delay - diff) / 1000);
                return res.status(429).json({
                    status: false,
                    message: "Please wait before requesting OTP again",
                    wait_seconds: remainingSeconds
                });
            }
        }

        // =========================
        // Check user
        // =========================
        const user = await User.findOne({ where: { phone: mobile } });

        // BUG #21 FIX: Block rejected vendors at sendOtp stage — was only blocked at verifyOtp, so rejected vendors could request infinite OTPs
        if (user) {
            const vendor = await Vendor.findOne({ where: { user_id: user.id } });
            if (vendor && vendor.application_status === 'REJECTED') {
                return res.status(403).json({
                    status: false,
                    flow: 'VENDOR_REJECTED',
                    message: 'Your vendor application has been rejected.',
                    status_reason: vendor.status_reason || 'Please contact support for details.'
                });
            }
        }

        // =========================
        // Generate OTP
        // =========================
        const otp = 123456; // FIXED OTP AS PER USER REQUEST (DEVELOPMENT)
        const expiry = new Date(Date.now() + 5 * 60 * 1000);

        logger.info(`[DEV] Generated OTP ${otp} for mobile ${mobile}`, {
            mobile,
            isNewUser: !user,
            otp
        });

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
            expires_at: expiry,
            status: "PENDING",
        });

        // BUG #3 FIX: TODO — integrate real SMS provider here. console.log below is dev-only.

        // BUG #3 FIX: Removed otp_code from sendOtp response — OTP must never be returned in API response
        // BUG #3 FIX: Replace console.log below with real SMS integration (MSG91 / Fast2SMS)
        console.log("[DEV ONLY - REMOVE IN PROD] OTP for", mobile, ":", otp);

        return res.json({
            status: true,
            message: user ? "OTP sent for login" : "OTP sent for onboarding",
            is_registered: !!user,
            resend_count: resendCount + 1
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
        // BUG #22 FIX: Added status_reason to VENDOR_REJECTED response — was returning no reason so frontend showed hardcoded text
        return res.status(403).json({
            status: false,
            flow: "VENDOR_REJECTED",
            message: "Your vendor application has been rejected.",
            status_reason: vendor.status_reason || null
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

        logger.info(`[DEV] Verifying OTP for mobile ${mobile}`, {
            mobile,
            otpInRequest: otp
        });

        if (!mobile || !otp) {
            return res.status(400).json({
                status: false,
                message: "Mobile and OTP are required",
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
            logger.warn(`[DEV] Invalid OTP attempt for ${mobile}`, { mobile, otp });
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
            // BUG #22 FIX: Added status_reason to VENDOR_REJECTED response — was returning no reason so frontend showed hardcoded text
            return res.status(403).json({
                status: false,
                flow: "VENDOR_REJECTED",
                message: "Your vendor application has been rejected.",
                status_reason: vendor.status_reason || null
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
        const allowedTypes = /jpeg|jpg|png|webp|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error("Only images (JPEG, PNG, WebP) and PDF files are allowed"));
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
        // BUG #14 FIX: Fixed typo 'buisness_logo' → 'business_logo'
        { name: 'business_logo', maxCount: 1 },
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
// Get admin profile (with full vendor data)
exports.getProfile = async (req, res) => {
    // BUG #18 FIX: Uncommented try block in getProfile — was crashing Node process on any DB error
    try {
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

        // BUG #18 FIX: Uncommented catch block in getProfile
    } catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get profile",
        });
    }
};

exports.updateProfile = async (req, res) => {
    // BUG #18 FIX: Uncommented try block in updateProfile — was crashing Node process on any DB error
    try {
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
            // BUG #35 FIX: Removed status, application_status, kyc_status, status_reason, remark from destructuring
            // These fields must only be set by admin endpoints — a vendor was able to self-approve their KYC by sending application_status:"APPROVED"
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

        if (req.files?.panCard) files.pan_card_path = `storage/documents/${req.files.panCard[0].filename}`;
        // BUG #14 FIX: Fixed typo in file field name
        if (req.files?.business_logo) files.business_logo = `storage/documents/${req.files.business_logo[0].filename}`;
        if (req.files?.gstinCertificate) files.gstin_certificate_path = `storage/documents/${req.files.gstinCertificate[0].filename}`;
        if (req.files?.msmeCertificate) files.msme_certificate_path = `storage/documents/${req.files.msmeCertificate[0].filename}`;
        if (req.files?.shopEstablishment) files.shop_establishment_path = `storage/documents/${req.files.shopEstablishment[0].filename}`;
        if (req.files?.cancelledCheque) files.cancelled_cheque_path = `storage/documents/${req.files.cancelledCheque[0].filename}`;
        // BUG #29 FIX: Fixed field name from id_proof_path to idProof to match multer field definition and frontend FormData
        if (req.files?.idProof) files.id_proof_path = `storage/documents/${req.files.idProof[0].filename}`;

        /* ✅ newly added fields */
        if (req.files?.businessLicense) files.business_license_path = `storage/documents/${req.files.businessLicense[0].filename}`;
        if (req.files?.insurancePolicy) files.insurance_policy_path = `storage/documents/${req.files.insurancePolicy[0].filename}`;
        if (req.files?.experienceCertificate) files.experience_certificate_path = `storage/documents/${req.files.experienceCertificate[0].filename}`;
        /* ================= VENDOR UPDATE ================= */
        // BUG #35 FIX: Removed status, application_status, kyc_status, status_reason, remark from vendor self-update
        // These fields must only be set by admin endpoints — a vendor was able to self-approve their KYC by sending application_status:"APPROVED"
        await Vendor.update(
            {
                business_name,
                business_entityname,
                business_address,
                //  business_description,
                city,
                state,
                pincode,

                // website,
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

        // BUG #18 FIX: Uncommented catch block in updateProfile
    } catch (error) {
        console.error("updateProfile error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
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
            // BUG #22 FIX: Added status_reason to VENDOR_REJECTED response — was returning no reason so frontend showed hardcoded text
            return res.status(403).json({
                message: "Your vendor application has been rejected.",
                status: "rejected",
                flow: "VENDOR_REJECTED",
                status_reason: vendor.status_reason || null
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

    // FIX: Clean up OTP rows older than 24 hours before counting (same fix as sendOtp Bug #1)
    await sequelize.query(
        `DELETE FROM user_otps WHERE mobile = ? AND created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
        { replacements: [mobile] }
    );

    // ============================
    // HELPER (same file)
    // ============================
    // FIX: Changed default from null to 24h — prevents permanent block due to old test rows
    const getResendDelay = (count) => {
        switch (count) {
            case 0: return 0;                        // first send immediate
            case 1: return 60 * 1000;               // 1 minute
            case 2: return 5 * 60 * 1000;           // 5 minutes
            case 3: return 60 * 60 * 1000;          // 1 hour
            case 4: return 24 * 60 * 60 * 1000;     // 1 day
            default: return 24 * 60 * 60 * 1000;    // FIX: was null (permanent block), now 24h
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
    // BUG #2 FIX: OTP logged to console for dev only — must be replaced with real SMS when SMS is integrated
    console.log("[DEV ONLY - REMOVE IN PROD] Resend OTP for", mobile, ":", otp);

    // BUG #2 FIX: Removed otp_code from resendOtp response — OTP must never be exposed in API response
    return res.json({
        message: "OTP sent successfully",
        resend_count: resendCount + 1
    });


};



exports.uploadDocuments = uploadDocuments;