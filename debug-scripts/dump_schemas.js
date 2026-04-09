const { User, Vendor, Role, Batch, Trek, AuditLog } = require('./models');
const fs = require('fs');

async function dumpSchemas() {
    const schemas = {
        User: await User.describe(),
        Vendor: await Vendor.describe(),
        Role: await Role.describe(),
        Batch: await Batch.describe(),
        // Check what audit log model is named
    };
    try {
        const { CouponAuditLog } = require('./models');
        schemas.CouponAuditLog = await CouponAuditLog.describe();
    } catch (e) { }
    try {
        const { SystemAuditLog } = require('./models');
        schemas.SystemAuditLog = await SystemAuditLog.describe();
    } catch (e) { }

    fs.writeFileSync('schemas_dump.json', JSON.stringify(schemas, null, 2));
    console.log("Dumped schemas successfully.");
}
dumpSchemas().catch(console.error);
