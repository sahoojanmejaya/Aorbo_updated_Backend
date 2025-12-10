const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

class EmailNotificationService {
    constructor() {
        // SMTP configuration using provided details
        this.transporter = nodemailer.createTransport({
            host: 'smtp-relay.brevo.com',
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: '833681001@smtp-brevo.com',
                pass: 'XgDOs7Vht3j8HZJm'
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        // Email configuration
        this.config = {
            from: '"Arobo Backend System" <chintan.eclipso@gmail.com>',
            // Add recipient emails for different error types
            recipients: {
                critical: process.env.CRITICAL_ERROR_EMAIL || 'eclipsotech@gmail.com',
                high: process.env.HIGH_ERROR_EMAIL || 'eclipsotech@gmail.com',
                medium: process.env.MEDIUM_ERROR_EMAIL || 'eclipsotech@gmail.com',
                general: process.env.GENERAL_ERROR_EMAIL || 'eclipsotech@gmail.com',
            },
            // Rate limiting to prevent email spam
            rateLimits: {
                critical: 1 * 60 * 1000,    // 1 minute
                high: 5 * 60 * 1000,        // 5 minutes
                medium: 15 * 60 * 1000,     // 15 minutes
                general: 30 * 60 * 1000,    // 30 minutes
            }
        };

        // Track last sent times to implement rate limiting
        this.lastSentTimes = new Map();

        // Initialize and test connection
        this.initializeService();
    }

    async initializeService() {
        try {
            await this.transporter.verify();
            console.log('✅ Email notification service initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize email service:', error.message);
        }
    }

    /**
     * Determine error severity based on error details
     */
    categorizeError(error, context = {}) {
        const message = error.message?.toLowerCase() || '';
        const stack = error.stack?.toLowerCase() || '';

        // Critical errors - immediate attention required
        if (
            message.includes('database') && message.includes('connection') ||
            message.includes('econnrefused') ||
            message.includes('payment') && message.includes('failed') ||
            message.includes('razorpay') ||
            message.includes('authentication') && message.includes('failed') ||
            message.includes('unknown column') ||
            message.includes('table') && message.includes('exist') ||
            context.category === 'payment' ||
            context.category === 'database' ||
            context.errorType === 'SequelizeDatabaseError' ||
            context.statusCode >= 500
        ) {
            return 'critical';
        }

        // High priority errors
        if (
            message.includes('validation') && message.includes('failed') ||
            message.includes('unauthorized') ||
            message.includes('forbidden') ||
            message.includes('booking') && message.includes('failed') ||
            message.includes('firebase') && message.includes('token') ||
            message.includes('jwt') && message.includes('verification') ||
            context.category === 'booking' ||
            context.category === 'auth' ||
            context.category === 'firebase_auth' ||
            context.category === 'firebase_token_verification' ||
            context.category === 'jwt_verification' ||
            context.category === 'jwt_validation' ||
            context.statusCode >= 400
        ) {
            return 'high';
        }

        // Medium priority errors
        if (
            message.includes('file') && message.includes('upload') ||
            message.includes('email') && message.includes('failed') ||
            message.includes('trek') ||
            context.category === 'trek' ||
            context.category === 'vendor'
        ) {
            return 'medium';
        }

        // General errors
        return 'general';
    }

    /**
     * Check if we can send an email based on rate limiting
     */
    canSendEmail(severity) {
        const key = `email_${severity}`;
        const lastSent = this.lastSentTimes.get(key);
        const rateLimit = this.config.rateLimits[severity];

        if (!lastSent) return true;

        return Date.now() - lastSent > rateLimit;
    }

    /**
     * Update last sent time for rate limiting
     */
    updateLastSentTime(severity) {
        const key = `email_${severity}`;
        this.lastSentTimes.set(key, Date.now());
    }

    /**
     * Generate detailed error report
     */
    generateErrorReport(error, context = {}) {
        const timestamp = new Date().toISOString();
        const severity = this.categorizeError(error, context);

        return {
            timestamp,
            severity,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
                code: error.code
            },
            context: {
                category: context.category || 'unknown',
                requestId: context.requestId,
                userId: context.userId,
                method: context.method,
                url: context.url,
                ip: context.ip,
                userAgent: context.userAgent,
                statusCode: context.statusCode,
                duration: context.duration,
                additionalData: context.additionalData || {}
            },
            server: {
                environment: process.env.NODE_ENV || 'development',
                nodeVersion: process.version,
                platform: process.platform,
                memory: process.memoryUsage(),
                uptime: process.uptime()
            }
        };
    }

    /**
     * Generate HTML email template
     */
    generateEmailTemplate(errorReport) {
        const { timestamp, severity, error, context, server } = errorReport;

        const severityColors = {
            critical: '#dc2626',
            high: '#ea580c',
            medium: '#ca8a04',
            general: '#059669'
        };

        const severityEmojis = {
            critical: '🚨',
            high: '⚠️',
            medium: '⚡',
            general: 'ℹ️'
        };

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Arobo Backend Error Alert - ${severity.toUpperCase()}</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background: #f8f9fa; }
        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: ${severityColors[severity]}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; }
        .section { margin-bottom: 25px; }
        .section h3 { color: #444; border-bottom: 2px solid #e9ecef; padding-bottom: 10px; }
        .info-grid { display: grid; grid-template-columns: 200px 1fr; gap: 10px; }
        .info-grid strong { color: #666; }
        .code { background: #f8f9fa; padding: 15px; border-radius: 5px; font-family: 'Courier New', monospace; font-size: 14px; border-left: 4px solid ${severityColors[severity]}; overflow-x: auto; }
        .stack-trace { max-height: 300px; overflow-y: auto; }
        .alert { padding: 15px; border-radius: 5px; margin: 15px 0; }
        .alert-${severity} { background: ${severityColors[severity]}15; border: 1px solid ${severityColors[severity]}; }
        .footer { background: #f8f9fa; padding: 15px 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; color: #666; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .badge-${severity} { background: ${severityColors[severity]}; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${severityEmojis[severity]} Arobo Backend Error Alert</h1>
            <p><span class="badge badge-${severity}">${severity.toUpperCase()}</span> Error occurred at ${new Date(timestamp).toLocaleString()}</p>
        </div>

        <div class="content">
            <div class="alert alert-${severity}">
                <strong>${severityEmojis[severity]} Error Summary:</strong> ${error.message}
            </div>

            ${error.stack ? `
            <div class="section">
                <h3>🔍 Quick Debug Info</h3>
                <div class="code" style="max-height: 200px; overflow-y: auto; font-size: 12px;">
${error.stack.split('\n').slice(0, 8).join('\n')}
                </div>
            </div>
            ` : ''}

            <div class="section">
                <h3>📋 Error Details</h3>
                <div class="info-grid">
                    <strong>Error Type:</strong> <span>${error.name}</span>
                    <strong>Error Code:</strong> <span>${error.code || 'N/A'}</span>
                    <strong>Severity:</strong> <span class="badge badge-${severity}">${severity}</span>
                    <strong>Category:</strong> <span>${context.category}</span>
                    <strong>Status Code:</strong> <span>${context.statusCode || 'N/A'}</span>
                </div>
            </div>

            ${context.requestId ? `
            <div class="section">
                <h3>🌐 Request Information</h3>
                <div class="info-grid">
                    <strong>Request ID:</strong> <span>${context.requestId}</span>
                    <strong>Method:</strong> <span>${context.method || 'N/A'}</span>
                    <strong>URL:</strong> <span>${context.url || 'N/A'}</span>
                    <strong>User ID:</strong> <span>${context.userId || 'Anonymous'}</span>
                    <strong>IP Address:</strong> <span>${context.ip || 'N/A'}</span>
                    <strong>Duration:</strong> <span>${context.duration || 'N/A'}</span>
                </div>
            </div>
            ` : ''}

            <div class="section">
                <h3>🖥️ Server Information</h3>
                <div class="info-grid">
                    <strong>Environment:</strong> <span>${server.environment}</span>
                    <strong>Node Version:</strong> <span>${server.nodeVersion}</span>
                    <strong>Platform:</strong> <span>${server.platform}</span>
                    <strong>Uptime:</strong> <span>${Math.round(server.uptime / 60)} minutes</span>
                    <strong>Memory Usage:</strong> <span>${Math.round(server.memory.heapUsed / 1024 / 1024)} MB</span>
                </div>
            </div>

            ${error.stack ? `
            <div class="section">
                <h3>📚 Stack Trace</h3>
                <div class="code stack-trace">
${error.stack}
                </div>
            </div>
            ` : ''}

            ${Object.keys(context.additionalData).length > 0 ? `
            <div class="section">
                <h3>📊 Additional Data & Context</h3>
                <div class="code" style="max-height: 300px; overflow-y: auto;">
${JSON.stringify(context.additionalData, null, 2)}
                </div>
            </div>
            ` : ''}

            ${context.additionalData?.sql ? `
            <div class="section">
                <h3>💾 SQL Query</h3>
                <div class="code" style="background: #f1f5f9; border-left: 4px solid #ef4444;">
${context.additionalData.sql}
                </div>
                ${context.additionalData.parameters ? `
                <p><strong>Parameters:</strong></p>
                <div class="code" style="background: #f8f9fa;">
${JSON.stringify(context.additionalData.parameters, null, 2)}
                </div>
                ` : ''}
            </div>
            ` : ''}
        </div>

        <div class="footer">
            <p>This email was automatically generated by the Arobo Backend Error Monitoring System</p>
            <p>Timestamp: ${timestamp} | Server: ${server.environment}</p>
        </div>
    </div>
</body>
</html>
        `.trim();
    }

    /**
     * Send error notification email
     */
    async sendErrorNotification(error, context = {}) {
        try {
            const errorReport = this.generateErrorReport(error, context);
            const { severity } = errorReport;

            // Check rate limiting
            if (!this.canSendEmail(severity)) {
                console.log(`⏰ Email rate limited for ${severity} errors. Skipping notification.`);
                return { success: false, reason: 'rate_limited' };
            }

            const recipient = this.config.recipients[severity];
            const htmlContent = this.generateEmailTemplate(errorReport);

            const mailOptions = {
                from: this.config.from,
                to: recipient,
                subject: `🚨 Arobo Backend Alert [${severity.toUpperCase()}]: ${error.message.substring(0, 60)}...`,
                html: htmlContent,
                // Add text version for better compatibility
                text: `
Arobo Backend Error Alert - ${severity.toUpperCase()}

Error: ${error.message}
Category: ${context.category || 'unknown'}
Timestamp: ${errorReport.timestamp}
Request ID: ${context.requestId || 'N/A'}
URL: ${context.url || 'N/A'}
User ID: ${context.userId || 'N/A'}

Stack Trace:
${error.stack || 'No stack trace available'}

This is an automated notification from the Arobo Backend Error Monitoring System.
                `.trim()
            };

            const result = await this.transporter.sendMail(mailOptions);

            // Update rate limiting
            this.updateLastSentTime(severity);

            console.log(`✅ Error notification email sent successfully:`, {
                messageId: result.messageId,
                severity,
                recipient,
                errorMessage: error.message.substring(0, 100)
            });

            return {
                success: true,
                messageId: result.messageId,
                severity,
                recipient
            };

        } catch (emailError) {
            console.error('❌ Failed to send error notification email:', emailError);
            return {
                success: false,
                error: emailError.message
            };
        }
    }

    /**
     * Send test email to verify configuration
     */
    async sendTestEmail(recipient = null) {
        try {
            const testRecipient = recipient || this.config.recipients.general;

            const mailOptions = {
                from: this.config.from,
                to: testRecipient,
                subject: '✅ Arobo Backend Email Service Test',
                html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <h2>✅ Arobo Backend Email Service Test</h2>
        <div class="success">
            <strong>Success!</strong> Email service is working correctly.
        </div>
        <p><strong>Test Details:</strong></p>
        <ul>
            <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
            <li><strong>SMTP Server:</strong> smtp-relay.brevo.com</li>
            <li><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</li>
            <li><strong>Node Version:</strong> ${process.version}</li>
        </ul>
        <p>This confirms that the error notification system is ready to send alerts.</p>
    </div>
</body>
</html>
                `,
                text: `
Arobo Backend Email Service Test

Success! Email service is working correctly.

Test Details:
- Timestamp: ${new Date().toISOString()}
- SMTP Server: smtp-relay.brevo.com
- Environment: ${process.env.NODE_ENV || 'development'}
- Node Version: ${process.version}

This confirms that the error notification system is ready to send alerts.
                `
            };

            const result = await this.transporter.sendMail(mailOptions);

            console.log('✅ Test email sent successfully:', {
                messageId: result.messageId,
                recipient: testRecipient
            });

            return {
                success: true,
                messageId: result.messageId,
                recipient: testRecipient
            };

        } catch (error) {
            console.error('❌ Failed to send test email:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get service status and statistics
     */
    getStatus() {
        return {
            service: 'EmailNotificationService',
            status: 'active',
            configuration: {
                smtpHost: 'smtp-relay.brevo.com',
                smtpPort: 587,
                fromEmail: this.config.from
            },
            rateLimits: this.config.rateLimits,
            lastSentTimes: Object.fromEntries(this.lastSentTimes)
        };
    }
}

// Export singleton instance
module.exports = new EmailNotificationService();