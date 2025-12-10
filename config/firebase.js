const admin = require("firebase-admin");
const logger = require("../utils/logger");

// Initialize Firebase Admin SDK
const initializeFirebase = () => {
    try {
        // Check if Firebase is already initialized
        if (admin.apps.length === 0) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    type: "service_account",
                    project_id: process.env.FIREBASE_PROJECT_ID,
                    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
                    private_key: process.env.FIREBASE_PRIVATE_KEY
                        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
                        : undefined,
                    client_email: process.env.FIREBASE_CLIENT_EMAIL,
                    client_id: process.env.FIREBASE_CLIENT_ID,
                    auth_uri: "https://accounts.google.com/o/oauth2/auth",
                    token_uri: "https://oauth2.googleapis.com/token",
                    auth_provider_x509_cert_url:
                        "https://www.googleapis.com/oauth2/v1/certs",
                    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
                }),
                databaseURL: process.env.FIREBASE_DATABASE_URL,
            });
            console.log("Firebase Admin SDK initialized successfully");
        }
    } catch (error) {
        console.error("Error initializing Firebase Admin SDK:", error);

        // Log Firebase initialization error with email notification
        logger.logErrorObject('auth', error, {
            category: 'firebase_initialization',
            context: 'startup',
            firebaseConfig: {
                hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
                hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
                hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL
            }
        });

        throw error;
    }
};

// Verify Firebase ID Token
const verifyFirebaseToken = async (idToken) => {
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return {
            success: true,
            uid: decodedToken.uid,
            phone: decodedToken.phone_number,
            email: decodedToken.email,
            emailVerified: decodedToken.email_verified,
            authTime: decodedToken.auth_time,
            issuedAt: decodedToken.iat,
            audience: decodedToken.aud,
            issuer: decodedToken.iss,
        };
    } catch (error) {
        console.error("Error verifying Firebase token:", error);

        // Log Firebase token verification error with detailed context
        logger.logAuthError(error, {
            category: 'firebase_token_verification',
            tokenProvided: !!idToken,
            tokenLength: idToken ? idToken.length : 0,
            tokenPreview: idToken ? `${idToken.substring(0, 20)}...` : null,
            errorCode: error.code,
            errorDetails: error.message
        });

        return {
            success: false,
            error: error.message,
        };
    }
};

// Get user by phone number
const getUserByPhone = async (phoneNumber) => {
    try {
        const userRecord = await admin.auth().getUserByPhoneNumber(phoneNumber);
        return {
            success: true,
            user: userRecord,
        };
    } catch (error) {
        console.error("Error getting user by phone:", error);

        // Log Firebase getUserByPhone error
        logger.logAuthError(error, {
            category: 'firebase_get_user',
            phoneNumber: phoneNumber ? `+**${phoneNumber.slice(-4)}` : null, // Masked phone for privacy
            errorCode: error.code,
            errorDetails: error.message
        });

        return {
            success: false,
            error: error.message,
        };
    }
};

module.exports = {
    initializeFirebase,
    verifyFirebaseToken,
    getUserByPhone,
    admin,
};
