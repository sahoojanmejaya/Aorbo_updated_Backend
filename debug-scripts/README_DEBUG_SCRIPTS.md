# Backend Debug Scripts

This folder contains all debug, test, and documentation files used during development and troubleshooting.

## Test Scripts

### Authentication & API Testing
- `test-admin-token.js` - Tests admin token generation and validation
- `test-api-response.js` - Tests API response structure
- `test-api.js` - General API endpoint testing
- `test-endpoints.js` - Comprehensive endpoint testing
- `test-token.js` - Token validation testing

### Coupon System Testing
- `test-all-coupon-scopes.js` - Tests all coupon scope types
- `test-coupon-api-response.js` - Tests coupon API response structure
- `test-coupon-data.js` - Tests coupon data integrity
- `test-coupon-structure.js` - Tests coupon model structure

### Vendor System Testing
- `test-vendor-debug.js` - Vendor system debugging
- `test-vendor-main.js` - Main vendor functionality tests
- `test-vendor-search.js` - Vendor search functionality
- `test-vendor-simple.js` - Simple vendor operations
- `test-vendor-specific.js` - Specific vendor tests
- `test-vendor-sql.js` - Vendor SQL query tests
- `test-vendor-stats.js` - Vendor statistics tests

### Database Scripts
- `create-audit-logs-table.js` - Creates audit logs table
- `create-missing-tables.js` - Creates missing database tables

### Frontend Integration Testing
- `test-frontend-fix.js` - Tests frontend API integration fixes
- `test-direct-controller.js` - Direct controller testing

## Documentation Files

### Status Reports
- `SERVER_STATUS_REPORT.md` - Current server status
- `CURRENT_STATUS_SUMMARY.md` - Overall system status
- `FINAL_STATUS_UPDATE.md` - Final deployment status

### Fix Documentation
- `ALL_FIXES_APPLIED.md` - Complete list of applied fixes
- `COMPLETE_API_FIXES_SUMMARY.md` - API fixes summary
- `DATABASE_FIELD_FIXES_COMPLETE.md` - Database field fixes
- `FINAL_API_FIXES_SUMMARY.md` - Final API fixes

### Technical Documentation
- `API_ISSUES_DOCUMENTATION.md` - API issues and solutions
- `DEPLOYMENT_GUIDE.md` - Server deployment guide
- `LOGGING.md` - Logging configuration
- `PACKAGE_JSON_DATABASE_SUMMARY.md` - Package and database info

### Development Documentation
- `data-mapping-verification.md` - Data mapping verification
- `frontend-backend-payload-verification.md` - Payload verification
- `DATABASE_SCRIPTS_CANCELLATION_POLICIES.md` - Database scripts for policies
- `ADMIN_INTERFACE_UPDATES.md` - Admin interface updates

## Usage

These scripts are for development and debugging purposes only. They should not be deployed to production servers.

To run a test script:
```bash
node debug-scripts/test-script-name.js
```

## Important Notes

- All test scripts assume the server is running on localhost:3001
- Some scripts require valid admin tokens
- Database scripts should be run with caution
- Documentation files contain historical context and troubleshooting information