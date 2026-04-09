// PhonePe Payment Gateway — New OAuth2 API
// Credentials from PhonePe Developer Dashboard (Client Id / Client Secret / Client Version)
// Docs: https://developer.phonepe.com/v1/docs/oauth-integration

const config = {
    clientId: process.env.PHONEPE_CLIENT_ID || 'YOUR_CLIENT_ID',
    clientSecret: process.env.PHONEPE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
    clientVersion: parseInt(process.env.PHONEPE_CLIENT_VERSION || '1'),
    // UAT sandbox | Production: api.phonepe.com/apis/pg
    apiBaseUrl: process.env.NODE_ENV === 'production'
        ? 'https://api.phonepe.com/apis/pg'
        : 'https://api-preprod.phonepe.com/apis/pg-sandbox',
    tokenEndpoint: '/v1/oauth/token',
    payEndpoint: '/v2/pay',
    orderStatusEndpoint: '/v2/order',
    refundEndpoint: '/v2/refund',
};

module.exports = config;
