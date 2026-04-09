const db = require('../config/db');

exports.getVendors = async (req, res) => {
    try {
        const [vendors] = await db.query(`
            SELECT 
                v.id, 
                v.business_name as name, 
                u.email, 
                u.phone as contact_number,
                v.account_holder_name,
                v.account_number,
                v.ifsc_code,
                v.bank_name,
                v.balance_locked,
                v.balance_available,
                v.balance_pending_refund,
                'CURRENT' as account_type
            FROM vendors v
            LEFT JOIN users u ON v.user_id = u.id
        `);

        const vendorsWithBalances = vendors.map(v => ({
            id: v.id ? v.id.toString() : '0',
            name: v.name || 'Unknown Vendor',
            email: v.email,
            contact_number: v.contact_number,
            bank_details: {
                account_holder_name: v.account_holder_name,
                account_number: v.account_number,
                ifsc_code: v.ifsc_code,
                bank_name: v.bank_name,
                account_type: 'CURRENT'
            },
            balances: {
                locked: parseFloat(v.balance_locked || 0),
                available: parseFloat(v.balance_available || 0),
                pending_refund: parseFloat(v.balance_pending_refund || 0)
            }
        }));

        res.json(vendorsWithBalances);
    } catch (err) {
        console.error("Error fetching vendors:", err);
        res.status(500).json({ error: 'Server Error' });
    }
};
