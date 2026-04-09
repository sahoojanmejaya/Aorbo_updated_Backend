const { Customer, Traveler } = require("../../models");
const jwt = require("jsonwebtoken");
const { verifyFirebaseToken } = require("../../config/firebase");
const logger = require("../../utils/logger");

// Verify Firebase ID Token and login/register customer
exports.firebaseVerify = async (req, res) => {
    try {
        const { firebaseIdToken } = req.body;

        if (!firebaseIdToken) {
            return res.status(400).json({
                success: false,
                message: "Firebase ID token is required",
            });
        }

        // Verify Firebase ID token
        const firebaseResult = await verifyFirebaseToken(firebaseIdToken);

        if (!firebaseResult.success) {
            // Log Firebase token verification failure
            logger.logAuthError(new Error(`Firebase token verification failed: ${firebaseResult.error}`), {
                firebaseError: firebaseResult.error,
                tokenProvided: !!firebaseIdToken,
                tokenLength: firebaseIdToken ? firebaseIdToken.length : 0,
                endpoint: '/api/v1/customer/auth/firebase-verify'
            });

            return res.status(401).json({
                success: false,
                message: "Invalid Firebase token",
                error: firebaseResult.error,
            });
        }

        const { phone, email, uid } = firebaseResult;

        if (!phone) {
            return res.status(400).json({
                success: false,
                message: "Phone number not found in Firebase token",
            });
        }

        // Find or create customer
        let customer = await Customer.findOne({ where: { phone } });

        if (!customer) {
            // Create new customer
            customer = await Customer.create({
                phone,
                email: email || null,
                firebase_uid: uid,
                verification_status: "verified",
                last_login: new Date(),
            });
        } else {
            // Update existing customer
            await customer.update({
                firebase_uid: uid,
                email: email || customer.email,
                verification_status: "verified",
                last_login: new Date(),
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: customer.id,
                phone: customer.phone,
                type: "customer",
                firebase_uid: uid,
            },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        res.json({
            success: true,
            message: customer.profile_completed
                ? "Login successful"
                : "Account created successfully",
            data: {
                token,
                customer: {
                    id: customer.id,
                    phone: customer.phone,
                    name: customer.name,
                    email: customer.email,
                    profileCompleted: customer.profile_completed,
                    isNewCustomer: !customer.profile_completed,
                },
                expiresIn: "30d",
            },
        });
    } catch (error) {
        // Log comprehensive Firebase verification error with email notification
        logger.logAuthError(error, {
            category: 'firebase_auth',
            endpoint: '/api/v1/customer/auth/firebase-verify',
            firebaseTokenProvided: !!req.body.firebaseIdToken,
            tokenLength: req.body.firebaseIdToken ? req.body.firebaseIdToken.length : 0,
            errorType: 'firebase_verification_exception',
            statusCode: 500
        });

        res.status(500).json({
            success: false,
            message: "Failed to verify Firebase token",
        });
    }
};

// Update customer profile
exports.updateProfile = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            name,
            email,
            dateOfBirth,
            emergencyContact,
            city_id,
            state_id,
        } = req.body;
        const customerId = req.customer.id;

        const updateData = {};

        // Handle name fields
        if (firstName && lastName) {
            updateData.name = `${firstName} ${lastName}`;
        } else if (name) {
            updateData.name = name;
        }

        if (email) updateData.email = email;
        if (dateOfBirth) updateData.date_of_birth = dateOfBirth;
        if (emergencyContact) updateData.emergency_contact = emergencyContact;
        if (city_id) updateData.city_id = city_id;
        if (state_id) updateData.state_id = state_id;

        updateData.profile_completed = true;

        const customer = await Customer.findByPk(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found",
            });
        }

        await customer.update(updateData);

        res.json({
            success: true,
            message: "Profile updated successfully",
            data: {
                customer: {
                    id: customer.id,
                    phone: customer.phone,
                    name: customer.name,
                    email: customer.email,
                    dateOfBirth: customer.date_of_birth,
                    emergencyContact: customer.emergency_contact,
                    profileCompleted: customer.profile_completed,
                },
            },
        });
    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update profile",
        });
    }
};

// Get customer profile
exports.getProfile = async (req, res) => {
    try {
        const customerId = req.customer.id;

        const customer = await Customer.findByPk(customerId, {
            include: [
                {
                    model: Traveler,
                    as: "travelers",
                    where: { is_active: true },
                    required: false,
                },
                {
                    model: require("../../models").City,
                    as: "city",
                    attributes: ["id", "cityName"],
                },
                {
                    model: require("../../models").State,
                    as: "state",
                    attributes: ["id", "name"],
                },
            ],
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found",
            });
        }

        res.json({
            success: true,
            data: {
                customer: {
                    id: customer.id,
                    phone: customer.phone,
                    name: customer.name,
                    email: customer.email,
                    dateOfBirth: customer.date_of_birth,
                    emergencyContact: customer.emergency_contact,
                    profileCompleted: customer.profile_completed,
                    city: customer.city,
                    state: customer.state,
                    travelers: customer.travelers || [],
                },
            },
        });
    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch profile",
        });
    }
};
