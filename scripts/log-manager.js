#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const logsDir = path.join(__dirname, "..", "logs");

function listLogFiles() {
    console.log("\n📁 Available Log Files:");
    console.log("========================");

    if (!fs.existsSync(logsDir)) {
        console.log("❌ Logs directory does not exist");
        return;
    }

    const files = fs.readdirSync(logsDir);
    const logFiles = files.filter((file) => file.endsWith(".log"));

    if (logFiles.length === 0) {
        console.log("📭 No log files found");
        return;
    }

    // Group by date
    const filesByDate = {};
    logFiles.forEach((file) => {
        const match = file.match(/(\d{4}-\d{2}-\d{2})/);
        if (match) {
            const date = match[1];
            if (!filesByDate[date]) filesByDate[date] = [];
            filesByDate[date].push(file);
        }
    });

    Object.keys(filesByDate)
        .sort()
        .reverse()
        .forEach((date) => {
            console.log(`\n📅 ${date}:`);
            filesByDate[date].forEach((file) => {
                const stats = fs.statSync(path.join(logsDir, file));
                const size = (stats.size / 1024).toFixed(2);
                console.log(`   📄 ${file} (${size} KB)`);
            });
        });
}

function showRecentErrors(limit = 10) {
    console.log(`\n🚨 Recent Errors (last ${limit}):`);
    console.log("================================");

    const errorFiles = fs
        .readdirSync(logsDir)
        .filter((file) => file.includes("error") && file.endsWith(".log"))
        .sort()
        .reverse();

    if (errorFiles.length === 0) {
        console.log("✅ No error logs found");
        return;
    }

    let errorCount = 0;
    for (const file of errorFiles) {
        if (errorCount >= limit) break;

        const filePath = path.join(logsDir, file);
        const content = fs.readFileSync(filePath, "utf8");
        const lines = content.split("\n").filter((line) => line.trim());

        for (const line of lines) {
            if (errorCount >= limit) break;
            if (line.includes("[ERROR]")) {
                console.log(`\n📄 ${file}:`);
                console.log(`   ${line}`);
                errorCount++;
            }
        }
    }
}

function showLogStats() {
    console.log("\n📊 Log Statistics:");
    console.log("==================");

    if (!fs.existsSync(logsDir)) {
        console.log("❌ Logs directory does not exist");
        return;
    }

    const files = fs.readdirSync(logsDir);
    const logFiles = files.filter((file) => file.endsWith(".log"));

    if (logFiles.length === 0) {
        console.log("📭 No log files found");
        return;
    }

    let totalSize = 0;
    let errorCount = 0;
    let infoCount = 0;
    let warnCount = 0;

    logFiles.forEach((file) => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;

        try {
            const content = fs.readFileSync(filePath, "utf8");
            const lines = content.split("\n");

            lines.forEach((line) => {
                if (line.includes("[ERROR]")) errorCount++;
                else if (line.includes("[INFO]")) infoCount++;
                else if (line.includes("[WARN]")) warnCount++;
            });
        } catch (err) {
            // Skip files that can't be read
        }
    });

    console.log(`📁 Total log files: ${logFiles.length}`);
    console.log(`💾 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`ℹ️  Info messages: ${infoCount}`);
    console.log(`⚠️  Warning messages: ${warnCount}`);
    console.log(`🚨 Error messages: ${errorCount}`);
}

function cleanOldLogs(days = 30) {
    console.log(`\n🧹 Cleaning logs older than ${days} days...`);
    console.log("==========================================");

    if (!fs.existsSync(logsDir)) {
        console.log("❌ Logs directory does not exist");
        return;
    }

    const files = fs.readdirSync(logsDir);
    const logFiles = files.filter((file) => file.endsWith(".log"));

    if (logFiles.length === 0) {
        console.log("📭 No log files found");
        return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let deletedCount = 0;
    let deletedSize = 0;

    logFiles.forEach((file) => {
        const match = file.match(/(\d{4}-\d{2}-\d{2})/);
        if (match) {
            const fileDate = new Date(match[1]);
            if (fileDate < cutoffDate) {
                const filePath = path.join(logsDir, file);
                const stats = fs.statSync(filePath);
                deletedSize += stats.size;

                try {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️  Deleted: ${file}`);
                    deletedCount++;
                } catch (err) {
                    console.log(`❌ Failed to delete: ${file}`);
                }
            }
        }
    });

    console.log(`\n✅ Cleanup complete:`);
    console.log(`   📄 Files deleted: ${deletedCount}`);
    console.log(
        `   💾 Space freed: ${(deletedSize / 1024 / 1024).toFixed(2)} MB`
    );
}

// CLI interface
const command = process.argv[2];

switch (command) {
    case "list":
        listLogFiles();
        break;
    case "errors":
        const limit = parseInt(process.argv[3]) || 10;
        showRecentErrors(limit);
        break;
    case "stats":
        showLogStats();
        break;
    case "clean":
        const days = parseInt(process.argv[3]) || 30;
        cleanOldLogs(days);
        break;
    default:
        console.log(`
🔧 Log Manager - Backend Logging System

Usage: node scripts/log-manager.js <command> [options]

Commands:
  list                    List all log files grouped by date
  errors [limit]          Show recent error messages (default: 10)
  stats                   Show log statistics
  clean [days]           Clean logs older than N days (default: 30)

Examples:
  node scripts/log-manager.js list
  node scripts/log-manager.js errors 20
  node scripts/log-manager.js stats
  node scripts/log-manager.js clean 14
        `);
}
