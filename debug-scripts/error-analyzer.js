const fs = require("fs");
const path = require("path");

class ErrorAnalyzer {
    constructor() {
        this.logsDir = path.join(__dirname, "..", "logs");
        this.errorPatterns = {
            trek: {
                create: /Failed to create trek/,
                update: /Failed to update trek/,
                delete: /Failed to delete trek/,
                validation: /Validation failed/,
                access: /Access denied/,
                notFound: /Trek not found/,
            },
            database: {
                connection: /Connection.*failed/,
                query: /Database query.*failed/,
                constraint: /foreign key constraint/,
                timeout: /timeout/,
            },
            auth: {
                unauthorized: /Unauthorized/,
                forbidden: /Forbidden/,
                token: /token.*invalid/,
            },
            file: {
                upload: /Failed to.*upload/,
                delete: /Failed to.*delete.*file/,
                save: /Failed to.*save.*file/,
            },
        };
    }

    // Get all log files
    getLogFiles() {
        if (!fs.existsSync(this.logsDir)) {
            console.log("Logs directory not found");
            return [];
        }

        const files = fs.readdirSync(this.logsDir);
        return files.filter((file) => file.endsWith(".log"));
    }

    // Parse log file and extract errors
    parseLogFile(filePath) {
        const content = fs.readFileSync(filePath, "utf8");
        const lines = content.split("\n").filter((line) => line.trim());

        const errors = [];

        lines.forEach((line, index) => {
            try {
                const logEntry = JSON.parse(line);

                // Check if it's an error log
                if (logEntry.level === "ERROR" || logEntry.level === "error") {
                    errors.push({
                        timestamp: logEntry.timestamp,
                        message: logEntry.message,
                        category: this.getCategoryFromFilename(filePath),
                        metadata: logEntry,
                        lineNumber: index + 1,
                    });
                }
            } catch (e) {
                // Skip lines that aren't valid JSON
            }
        });

        return errors;
    }

    // Get category from filename
    getCategoryFromFilename(filename) {
        const name = path.basename(filename, ".log");
        if (name.includes("trek")) return "trek";
        if (name.includes("auth")) return "auth";
        if (name.includes("database")) return "database";
        if (name.includes("api")) return "api";
        if (name.includes("error")) return "error";
        return "general";
    }

    // Analyze errors by pattern
    analyzeErrors(errors) {
        const analysis = {
            totalErrors: errors.length,
            byCategory: {},
            byPattern: {},
            byTime: {},
            commonIssues: [],
            recommendations: [],
        };

        // Group by category
        errors.forEach((error) => {
            const category = error.category;
            if (!analysis.byCategory[category]) {
                analysis.byCategory[category] = [];
            }
            analysis.byCategory[category].push(error);
        });

        // Group by time (hour)
        errors.forEach((error) => {
            const hour = new Date(error.timestamp).getHours();
            if (!analysis.byTime[hour]) {
                analysis.byTime[hour] = 0;
            }
            analysis.byTime[hour]++;
        });

        // Pattern matching
        errors.forEach((error) => {
            Object.keys(this.errorPatterns).forEach((category) => {
                Object.keys(this.errorPatterns[category]).forEach((pattern) => {
                    const regex = this.errorPatterns[category][pattern];
                    if (regex.test(error.message)) {
                        const key = `${category}.${pattern}`;
                        if (!analysis.byPattern[key]) {
                            analysis.byPattern[key] = [];
                        }
                        analysis.byPattern[key].push(error);
                    }
                });
            });
        });

        // Generate recommendations
        this.generateRecommendations(analysis);

        return analysis;
    }

    // Generate recommendations based on error patterns
    generateRecommendations(analysis) {
        const recommendations = [];

        // Trek-related recommendations
        if (
            analysis.byPattern["trek.delete"] &&
            analysis.byPattern["trek.delete"].length > 0
        ) {
            recommendations.push({
                type: "trek_delete",
                priority: "high",
                message:
                    "Trek deletion failures detected. Check foreign key constraints and related data cleanup.",
                count: analysis.byPattern["trek.delete"].length,
                suggestion:
                    "Ensure all related records (images, stages, batches) are deleted before trek deletion.",
            });
        }

        if (
            analysis.byPattern["trek.validation"] &&
            analysis.byPattern["trek.validation"].length > 0
        ) {
            recommendations.push({
                type: "trek_validation",
                priority: "medium",
                message:
                    "Trek validation failures detected. Check form data and validation rules.",
                count: analysis.byPattern["trek.validation"].length,
                suggestion:
                    "Review validation middleware and ensure all required fields are properly validated.",
            });
        }

        if (
            analysis.byPattern["auth.unauthorized"] &&
            analysis.byPattern["auth.unauthorized"].length > 0
        ) {
            recommendations.push({
                type: "auth_issues",
                priority: "medium",
                message:
                    "Authentication failures detected. Check token validation and user sessions.",
                count: analysis.byPattern["auth.unauthorized"].length,
                suggestion:
                    "Review authentication middleware and token handling.",
            });
        }

        if (
            analysis.byPattern["database.connection"] &&
            analysis.byPattern["database.connection"].length > 0
        ) {
            recommendations.push({
                type: "database_connection",
                priority: "critical",
                message:
                    "Database connection issues detected. Check database server and connection pool.",
                count: analysis.byPattern["database.connection"].length,
                suggestion:
                    "Check database server status, connection pool settings, and network connectivity.",
            });
        }

        analysis.recommendations = recommendations;
    }

    // Generate detailed report
    generateReport(analysis) {
        const report = {
            summary: {
                totalErrors: analysis.totalErrors,
                categories: Object.keys(analysis.byCategory),
                timeRange: this.getTimeRange(analysis),
            },
            details: analysis,
            topIssues: this.getTopIssues(analysis),
            trends: this.getTrends(analysis),
        };

        return report;
    }

    // Get time range of errors
    getTimeRange(analysis) {
        const timestamps = Object.values(analysis.byCategory)
            .flat()
            .map((error) => new Date(error.timestamp))
            .sort();

        if (timestamps.length === 0) return null;

        return {
            start: timestamps[0],
            end: timestamps[timestamps.length - 1],
            duration: timestamps[timestamps.length - 1] - timestamps[0],
        };
    }

    // Get top issues
    getTopIssues(analysis) {
        const issues = [];

        Object.keys(analysis.byPattern).forEach((pattern) => {
            const count = analysis.byPattern[pattern].length;
            if (count > 0) {
                issues.push({
                    pattern,
                    count,
                    percentage: ((count / analysis.totalErrors) * 100).toFixed(
                        2
                    ),
                });
            }
        });

        return issues.sort((a, b) => b.count - a.count).slice(0, 10);
    }

    // Get trends
    getTrends(analysis) {
        const hourlyTrends = Object.entries(analysis.byTime)
            .map(([hour, count]) => ({ hour: parseInt(hour), count }))
            .sort((a, b) => a.hour - b.hour);

        return {
            hourly: hourlyTrends,
            peakHour: hourlyTrends.reduce(
                (max, current) => (current.count > max.count ? current : max),
                { hour: 0, count: 0 }
            ),
        };
    }

    // Main analysis function
    async analyze() {
        console.log("🔍 Starting error analysis...\n");

        const logFiles = this.getLogFiles();
        if (logFiles.length === 0) {
            console.log("No log files found in logs directory");
            return;
        }

        console.log(`📁 Found ${logFiles.length} log files`);

        let allErrors = [];

        logFiles.forEach((file) => {
            const filePath = path.join(this.logsDir, file);
            const errors = this.parseLogFile(filePath);
            allErrors = allErrors.concat(errors);
            console.log(`📄 ${file}: ${errors.length} errors`);
        });

        if (allErrors.length === 0) {
            console.log("\n✅ No errors found in log files");
            return;
        }

        console.log(`\n📊 Total errors found: ${allErrors.length}`);

        const analysis = this.analyzeErrors(allErrors);
        const report = this.generateReport(analysis);

        // Display summary
        console.log("\n📈 ERROR ANALYSIS SUMMARY");
        console.log("========================");
        console.log(`Total Errors: ${report.summary.totalErrors}`);
        console.log(`Categories: ${report.summary.categories.join(", ")}`);

        if (report.summary.timeRange) {
            const duration = Math.round(
                report.summary.timeRange.duration / (1000 * 60 * 60)
            ); // hours
            console.log(
                `Time Range: ${report.summary.timeRange.start.toISOString()} to ${report.summary.timeRange.end.toISOString()} (${duration} hours)`
            );
        }

        // Display top issues
        console.log("\n🔥 TOP ISSUES");
        console.log("=============");
        report.topIssues.forEach((issue, index) => {
            console.log(
                `${index + 1}. ${issue.pattern}: ${issue.count} errors (${
                    issue.percentage
                }%)`
            );
        });

        // Display recommendations
        console.log("\n💡 RECOMMENDATIONS");
        console.log("==================");
        report.details.recommendations.forEach((rec, index) => {
            console.log(
                `${index + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`
            );
            console.log(
                `   Count: ${rec.count} | Suggestion: ${rec.suggestion}`
            );
        });

        // Display hourly trends
        console.log("\n⏰ HOURLY TRENDS");
        console.log("================");
        const peakHour = report.trends.peakHour;
        console.log(
            `Peak error hour: ${peakHour.hour}:00 (${peakHour.count} errors)`
        );

        // Save detailed report to file
        const reportPath = path.join(
            this.logsDir,
            `error-analysis-${new Date().toISOString().split("T")[0]}.json`
        );
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);

        return report;
    }
}

// CLI usage
if (require.main === module) {
    const analyzer = new ErrorAnalyzer();
    analyzer.analyze().catch(console.error);
}

module.exports = ErrorAnalyzer;
