/**
 * Security Middleware
 * Rate limiting, security headers, CORS, input sanitization
 */

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
// Helper function for consistent IP key generation
// express-rate-limit v7+ is very strict about custom keyGenerators using req.ip.
// We handle ::1 to 127.0.0.1 and strip IPv6 prefix for consistency.
const ipKeyGenerator = (req) => {
    const rawIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const ip = rawIp === '::1' ? '127.0.0.1' : rawIp.replace(/::ffff:/, '');
    
    // DEV LOGGING: Track limit hits and IP identification
    if (process.env.NODE_ENV === 'development') {
        const logger = require('../utils/logger');
        logger.info(`[SECURITY] IP identified for rate-limiting: ${ip}`, { 
            url: req.url, 
            method: req.method,
            rawIp
        });
    }
    
    return ip;
};

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

/** Login + OTP endpoints */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 1000 : 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many auth attempts. Try again in 15 minutes.' },
    keyGenerator: ipKeyGenerator,
});

/** OTP send (tighter than authLimiter) */
const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many OTP requests. Try again in 10 minutes.' },
    keyGenerator: ipKeyGenerator,
});

/** General API endpoints */
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: process.env.NODE_ENV === 'development' ? 2000 : 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Slow down.' },
    keyGenerator: ipKeyGenerator,
});

/** Payment initiation (strict) */
const paymentLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many payment attempts. Try again in 5 minutes.' },
    keyGenerator: (req) => (req.customer?.id ? `customer_${req.customer.id}` : ipKeyGenerator(req)),
});

/** Cancellation endpoint */
const cancellationLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many cancellation attempts.' },
    keyGenerator: (req) => (req.customer?.id ? `customer_${req.customer.id}` : ipKeyGenerator(req)),
});

/** File upload */
const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many upload requests.' },
    keyGenerator: ipKeyGenerator,
});

// ---------------------------------------------------------------------------
// Security headers via Helmet
// ---------------------------------------------------------------------------

const securityHeaders = helmet({
    contentSecurityPolicy: false, // API server — CSP not needed
    crossOriginResourcePolicy: { policy: 'cross-origin' },
});

// ---------------------------------------------------------------------------
// CORS options (restricted to known domains)
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
    'https://aorbotreks.co.in',
    'https://www.aorbotreks.co.in',
    'https://admin.aorbotreks.co.in',
    'https://partners.aorbotreks.co.in',
    // Dev origins only when NODE_ENV is development
    ...(process.env.NODE_ENV === 'development'
        ? [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:8080',
            'http://127.0.0.1:5173',
            // FIX: Added network IP origins so teammates on the same network are not blocked by CORS
            'http://192.168.29.113:8080',
            'http://192.168.29.113:3000',
            'http://192.168.29.113:5173',
        ]
        : []),
];

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, Postman in dev)
        if (!origin) {
            return callback(null, true);
        }
        if (ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }
        // FIX: In development, allow any local network IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
        // so teammates on the same network are never blocked by CORS
        if (process.env.NODE_ENV === 'development') {
            const localNetworkPattern = /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;
            if (localNetworkPattern.test(origin)) {
                return callback(null, true);
            }
        }
        callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Idempotency-Key'],
    optionsSuccessStatus: 200,
};

// ---------------------------------------------------------------------------
// Input sanitisation (strip common XSS vectors from string fields)
// ---------------------------------------------------------------------------

function sanitizeInput(req, _res, next) {
    const XSS_RE = /<script[\s\S]*?>[\s\S]*?<\/script>|javascript:|on\w+\s*=/gi;

    function sanitize(val) {
        if (typeof val === 'string') return val.replace(XSS_RE, '');
        if (Array.isArray(val)) return val.map(sanitize);
        if (val && typeof val === 'object') {
            const cleaned = {};
            for (const k of Object.keys(val)) cleaned[k] = sanitize(val[k]);
            return cleaned;
        }
        return val;
    }

    if (req.body) req.body = sanitize(req.body);
    if (req.query) req.query = sanitize(req.query);
    next();
}

// ---------------------------------------------------------------------------
// Token blacklist (in-memory; replace with Redis in production)
// ---------------------------------------------------------------------------

const _blacklist = new Set();

function blacklistToken(jti) {
    _blacklist.add(jti);
}

function isTokenBlacklisted(jti) {
    return _blacklist.has(jti);
}

module.exports = {
    authLimiter,
    otpLimiter,
    apiLimiter,
    paymentLimiter,
    cancellationLimiter,
    uploadLimiter,
    securityHeaders,
    corsOptions,
    sanitizeInput,
    blacklistToken,
    isTokenBlacklisted,
};
