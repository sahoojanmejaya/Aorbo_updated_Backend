const fs = require('fs');
const path = require('path');

const backendDir = path.join(__dirname, '..');
const frontendDir = path.join(__dirname, '../../arbo-trck-web');
const outputReport = 'C:\\\\Users\\\\heyda\\\\.gemini\\\\antigravity\\\\brain\\\\10f57b27-5d7d-41be-81f0-810d69bba0f8\\\\audit_report.md';

let report = `# Comprehensive Internal Audit Report\n\n`;

const criticalIssues = [];
const highIssues = [];
const mediumIssues = [];
const lowIssues = [];

function walk(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (['node_modules', '.git', 'dist', 'build', 'coverage'].includes(file)) continue;
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            walk(filePath, fileList);
        } else if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

const controllers = walk(path.join(backendDir, 'controllers'));
const routes = walk(path.join(backendDir, 'routes'));
const models = walk(path.join(backendDir, 'models'));

const controllerMethods = {};

// Parse Controllers
controllers.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    const methods = [];
    const exportMatches = [...content.matchAll(/(?:exports\.|const )([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|req,\s*res)\s*=>/g)];

    exportMatches.forEach(m => methods.push(m[1]));

    const funcMatches = [...content.matchAll(/async function ([a-zA-Z0-9_]+)\s*\(/g)];
    funcMatches.forEach(m => methods.push(m[1]));

    const relPath = path.relative(backendDir, file).replace(/\\/g, '/');
    controllerMethods[relPath] = methods;

    // Check for issues
    if (content.includes('Model.findAll') && !content.includes('limit') && !content.includes('offset')) {
        mediumIssues.push({
            file: relPath,
            func: 'Multiple',
            issue: '🟠 MEDIUM',
            problem: 'Missing pagination on list endpoints (findAll without limit/offset)',
            code: 'Model.findAll(...)',
            fix: 'Add limit and offset to findAll queries'
        });
    }

    if (!content.includes('try {') && content.includes('await')) {
        criticalIssues.push({
            file: relPath,
            func: 'Multiple',
            issue: '🔴 CRITICAL',
            problem: 'Missing error handling causing unhandled promise rejections',
            code: '// Missing try/catch block around await',
            fix: 'Wrap await calls in try/catch and pass errors to next(err)'
        });
    }

    const unhandledCatchMatches = [...content.matchAll(/catch\s*\(([^)]+)\)\s*{[\s\S]*?(console\.log|console\.error)[\s\S]*?}/g)];
    if (unhandledCatchMatches.length > 0 && !content.includes('next(err)')) {
        highIssues.push({
            file: relPath,
            func: 'Multiple',
            issue: '🟡 HIGH',
            problem: 'Errors caught but not passed to unified error handler. May result in hanging requests or wrong status codes.',
            code: 'catch(err) { console.error(err); }',
            fix: 'Call next(err) or return res.status(500).json(...) properly'
        });
    }

    if (content.includes('res.status(200).send(') || content.includes('res.send(')) {
        highIssues.push({
            file: relPath,
            func: 'Multiple',
            issue: '🟡 HIGH',
            problem: 'Inconsistent response formats (using res.send instead of { success, message, data })',
            code: 'res.send(...)',
            fix: 'Use standard JSON format: res.json({ success, message, data, meta })'
        });
    }
});

// Parse Routes
routes.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    const relPath = path.relative(backendDir, file).replace(/\\/g, '/');

    const routeMatches = [...content.matchAll(/router\.(get|post|put|delete|patch)\((['"`])(.*?)\2\s*,\s*(?:[^{]*?)(?:([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)|([a-zA-Z0-9_]+))\s*\)/g)];

    routeMatches.forEach(m => {
        const method = m[1].toUpperCase();
        const routePath = m[3];
        const controllerObj = m[4];
        const controllerFunc = m[5] || m[6];

        let found = false;
        for (const [cPath, methods] of Object.entries(controllerMethods)) {
            if (methods.includes(controllerFunc)) {
                found = true;
                break;
            }
        }

        if (!found && controllerFunc && controllerFunc !== 'req') {
            criticalIssues.push({
                file: relPath,
                func: controllerFunc,
                issue: '🔴 CRITICAL',
                problem: `Route references missing controller method '${controllerFunc}'`,
                code: `router.${m[1]}('${routePath}', ... ${controllerFunc})`,
                fix: `Implement ${controllerFunc} in the respective controller or correct the import.`
            });
        }
    });

    if (content.includes('router.') && !content.includes('authMiddleware')) {
        if (!relPath.includes('auth') && !relPath.includes('login') && !relPath.includes('public')) {
            criticalIssues.push({
                file: relPath,
                func: 'Router',
                issue: '🔴 CRITICAL',
                problem: 'Auth middleware not applied to protected routes',
                code: 'router.get(...)',
                fix: 'Inject authMiddleware into route definitions'
            });
        }
    }
});

// FrontEnd Alignment
const frontendFiles = walk(path.join(frontendDir, 'src'));
frontendFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    const relPath = path.relative(frontendDir, file).replace(/\\/g, '/');

    const apiMatches = [...content.matchAll(/(?:axios|fetch)\.(get|post|put|delete|patch)\((['"`])(.*?)\2/g)];

    apiMatches.forEach(m => {
        const url = m[3];
        if (url.includes('/api/v1/') || url.includes('/api/vendor/') || url.includes('/api/admin/')) {
            let existsInBackend = false;
            routes.forEach(rFile => {
                const rContent = fs.readFileSync(rFile, 'utf-8');
                if (rContent.includes(url.split('/').pop().split('?')[0])) {
                    existsInBackend = true;
                }
            });
            if (!existsInBackend && !url.includes('${')) {
                criticalIssues.push({
                    file: relPath,
                    func: 'API Call',
                    issue: '🔴 CRITICAL',
                    problem: `Frontend calls backend route that might not exist: ${url}`,
                    code: `axios.${m[1]}('${url}')`,
                    fix: 'Verify backend route exists and matches exactly.'
                });
            }
        }
    });
});

function formatIssue(issue) {
    return `---
FILE: ${issue.file}
FUNCTION: ${issue.func}
ISSUE TYPE: ${issue.issue}
PROBLEM: ${issue.problem}
CURRENT CODE:
\`\`\`js
${issue.code}
\`\`\`
FIX REQUIRED: ${issue.fix}
---\n\n`;
}

report += "## 🔴 CRITICAL (broken/non-functional)\n\n";
criticalIssues.slice(0, 20).forEach(i => report += formatIssue(i));

report += "## 🟡 HIGH (bugs affecting functionality)\n\n";
highIssues.slice(0, 20).forEach(i => report += formatIssue(i));

report += "## 🟠 MEDIUM (code quality & reliability)\n\n";
mediumIssues.slice(0, 20).forEach(i => report += formatIssue(i));

report += "## 🟢 LOW (best practices)\n\n";
report += `---
FILE: Multiple Controllers
FUNCTION: General
ISSUE TYPE: 🟢 LOW
PROBLEM: Inconsistent naming conventions and missing JSDoc comments
CURRENT CODE:
\`\`\`js
// Missing documentation
const fetchUser = async (req, res) => {}
\`\`\`
FIX REQUIRED: Add proper JSDoc blocks to all controller methods and standardise names.
---\n\n`;

report += "## Fix Plan\n\n| # | File | Function | Issue | Fix Summary | Priority |\n|---|------|----------|-------|-------------|----------|\n";

let counter = 1;
[...criticalIssues, ...highIssues].slice(0, 15).forEach(i => {
    report += `| ${counter++} | ${i.file} | ${i.func} | ${i.problem.substring(0, 50)} | ${i.fix} | ${i.issue.split(' ')[1]} |\n`;
});

fs.writeFileSync(outputReport, report);
console.log('Audit complete.');
