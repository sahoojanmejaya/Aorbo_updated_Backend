const app = require('../app');
const listEndpoints = require('express-list-endpoints');
const fs = require('fs');
const path = require('path');

try {
    const endpoints = listEndpoints(app);
    let output = '[\n';
    endpoints.forEach((ep, i) => {
        output += `  ${JSON.stringify(ep)}${i < endpoints.length - 1 ? ',' : ''}\n`;
    });
    output += ']\n';
    fs.writeFileSync(path.join(__dirname, 'endpoints.json'), output);
    console.log(`Successfully extracted ${endpoints.length} routes.`);
} catch (error) {
    console.error('Failed to parse endpoints:', error);
}
