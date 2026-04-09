const pool = require('../config/db');

/**
 * GET Dashboard Stats
 * Returns all KPI metrics for the dashboard
 */
const getDashboardStats = async (req, res) => {
    try {
        const { timeFilter, fromDate, toDate } = req.query;

        // Build date filter
        let dateCondition = '';
        let dateParams = [];

        if (timeFilter && timeFilter !== 'ALL') {
            const now = new Date();
            let startDate, endDate;

            switch (timeFilter) {
                case 'THIS MONTH':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                    break;
                case 'LAST MONTH':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
                    break;
                case 'THIS YEAR':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
                    break;
                case 'LAST YEAR':
                    startDate = new Date(now.getFullYear() - 1, 0, 1);
                    endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
                    break;
                case 'CUSTOM':
                    if (fromDate && toDate) {
                        startDate = new Date(fromDate);
                        endDate = new Date(toDate);
                        endDate.setHours(23, 59, 59);
                    }
                    break;
            }

            if (startDate && endDate) {
                dateCondition = ' AND redeemed_at BETWEEN ? AND ?';
                dateParams = [startDate, endDate];
            }
        }

        // 1. Get Current Period Stats
        const [currentStats] = await pool.query(`
            SELECT 
                COUNT(*) as totalRedemptions,
                COALESCE(SUM(booking_amount), 0) as totalRevenue,
                COALESCE(SUM(discount_amount), 0) as totalSavings
            FROM redemptions
            WHERE status = 'CONFIRMED' ${dateCondition}
        `, dateParams);

        // 2. Get Previous Period Stats for Trend Calculation
        let previousStats = [{ totalRedemptions: 0, totalRevenue: 0, totalSavings: 0 }];
        
        if (timeFilter && timeFilter !== 'ALL' && dateParams.length === 2) {
            const duration = dateParams[1].getTime() - dateParams[0].getTime();
            const prevStart = new Date(dateParams[0].getTime() - duration);
            const prevEnd = new Date(dateParams[0].getTime());

            [previousStats] = await pool.query(`
                SELECT 
                    COUNT(*) as totalRedemptions,
                    COALESCE(SUM(booking_amount), 0) as totalRevenue,
                    COALESCE(SUM(discount_amount), 0) as totalSavings
                FROM redemptions
                WHERE status = 'CONFIRMED' AND redeemed_at BETWEEN ? AND ?
            `, [prevStart, prevEnd]);
        }

        // 3. Get Active Coupons Count
        const [couponStats] = await pool.query(`
            SELECT COUNT(*) as activeCoupons
            FROM coupons
            WHERE status = 'ACTIVE'
        `);

        // 4. Calculate Trends
        const calculateTrend = (current, previous) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return ((current - previous) / previous) * 100;
        };

        const current = currentStats[0];
        const previous = previousStats[0];

        const stats = {
            totalRevenue: parseFloat(current.totalRevenue) || 0,
            totalRedemptions: parseInt(current.totalRedemptions) || 0,
            totalSavings: parseFloat(current.totalSavings) || 0,
            activeCoupons: parseInt(couponStats[0].activeCoupons) || 0,
            
            // Trends (only if not ALL filter)
            trends: timeFilter !== 'ALL' ? {
                revenueTrend: calculateTrend(current.totalRevenue, previous.totalRevenue),
                redemptionsTrend: calculateTrend(current.totalRedemptions, previous.totalRedemptions),
                savingsTrend: calculateTrend(current.totalSavings, previous.totalSavings)
            } : null
        };

        res.json(stats);

    } catch (err) {
        console.error('Dashboard Stats Error:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * GET Trend Data for Charts
 * Returns daily/weekly trend data for the specified period
 */
const getTrendData = async (req, res) => {
    try {
        const { timeFilter, fromDate, toDate, granularity = 'daily' } = req.query;

        let dateCondition = '';
        let dateParams = [];
        let groupByFormat = '%Y-%m-%d'; // Daily by default

        // Determine date range
        const now = new Date();
        let startDate, endDate;

        if (timeFilter === 'CUSTOM' && fromDate && toDate) {
            startDate = new Date(fromDate);
            endDate = new Date(toDate);
        } else {
            // Default to last 14 days
            startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            endDate = now;
        }

        dateCondition = ' WHERE redeemed_at BETWEEN ? AND ?';
        dateParams = [startDate, endDate];

        // Get trend data grouped by date
        const [trendData] = await pool.query(`
            SELECT 
                DATE_FORMAT(redeemed_at, ?) as date,
                COUNT(*) as redemptions,
                COALESCE(SUM(discount_amount), 0) as savings
            FROM redemptions
            ${dateCondition}
            GROUP BY DATE_FORMAT(redeemed_at, ?)
            ORDER BY date ASC
        `, [groupByFormat, ...dateParams, groupByFormat]);

        // Format for frontend
        const formattedData = trendData.map(row => ({
            name: new Date(row.date).toLocaleDateString('en-US', { weekday: 'short' }),
            redemptions: parseInt(row.redemptions),
            savings: parseFloat(row.savings)
        }));

        res.json(formattedData);

    } catch (err) {
        console.error('Trend Data Error:', err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * GET Scope Distribution
 * Returns breakdown of redemptions by coupon scope
 */
const getScopeDistribution = async (req, res) => {
    try {
        const { timeFilter, fromDate, toDate } = req.query;

        let dateCondition = '';
        let dateParams = [];

        if (timeFilter && timeFilter !== 'ALL') {
            const now = new Date();
            let startDate, endDate;

            switch (timeFilter) {
                case 'THIS MONTH':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                    break;
                case 'LAST MONTH':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
                    break;
                case 'THIS YEAR':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
                    break;
                case 'LAST YEAR':
                    startDate = new Date(now.getFullYear() - 1, 0, 1);
                    endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
                    break;
                case 'CUSTOM':
                    if (fromDate && toDate) {
                        startDate = new Date(fromDate);
                        endDate = new Date(toDate);
                        endDate.setHours(23, 59, 59);
                    }
                    break;
            }

            if (startDate && endDate) {
                dateCondition = ' WHERE redeemed_at BETWEEN ? AND ?';
                dateParams = [startDate, endDate];
            }
        }

        const [scopeData] = await pool.query(`
            SELECT 
                c.scope,
                COUNT(r.id) as count
            FROM redemptions r
            JOIN coupons c ON r.coupon_code = c.code
            ${dateCondition}
            GROUP BY c.scope
        `, dateParams);

        const scopeColors = {
            'PLATFORM': '#3b82f6',
            'NORMAL': '#10b981',
            'SPECIAL': '#f59e0b',
            'PREMIUM': '#8b5cf6',
            'INFLUENCER': '#ec4899'
        };

        const formattedData = scopeData.map(row => ({
            name: row.scope.charAt(0) + row.scope.slice(1).toLowerCase(),
            value: parseInt(row.count),
            color: scopeColors[row.scope] || '#6b7280'
        }));

        res.json(formattedData);

    } catch (err) {
        console.error('Scope Distribution Error:', err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getDashboardStats,
    getTrendData,
    getScopeDistribution
};
