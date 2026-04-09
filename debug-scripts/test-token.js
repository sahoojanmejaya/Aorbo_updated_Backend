const jwt = require('jsonwebtoken');

// Create a test admin token
const testPayload = {
    id: 1,
    email: 'admin@test.com',
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
};

const token = jwt.sign(testPayload, 'arbo-trek-super-secret-key-2024');
console.log('Test Token:', token);