#!/usr/bin/env node

const ErrorAnalyzer = require("./error-analyzer");

async function main() {
    console.log("🚀 Starting Error Analysis Tool");
    console.log("================================\n");

    try {
        const analyzer = new ErrorAnalyzer();
        await analyzer.analyze();

        console.log("\n✅ Analysis completed successfully!");
    } catch (error) {
        console.error("❌ Error during analysis:", error.message);
        process.exit(1);
    }
}

main();
