/**
 * Round amount according to custom rounding rules:
 * - 0.1 to 0.5: round down
 * - 0.6 to 0.9: round up
 * - 0.5: always round down
 * 
 * Examples:
 * - 99.1/99.2/99.3/99.4/99.5 → 99
 * - 99.6/99.7/99.8/99.9 → 100
 * - 288.5 → 288
 * 
 * @param {number} amount - The amount to round
 * @returns {number} - Rounded amount
 */
function roundAmount(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) {
        return 0;
    }
    
    // Convert to number if it's a string
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (isNaN(numAmount)) {
        return 0;
    }
    
    // Apply rounding logic: Math.floor(amount + 0.4) handles the special cases
    // For 0.1-0.5: adds 0.4, so max is 0.9, floor keeps original
    // For 0.6-0.9: adds 0.4, so becomes 1.0-1.3, floor rounds up
    // For exactly 0.5: adds 0.4, becomes 0.9, floor keeps original (rounds down)
    return Math.floor(numAmount + 0.4);
}

/**
 * Round amount and return as string (formatted)
 * @param {number} amount - The amount to round
 * @returns {string} - Rounded amount as string
 */
function roundAmountToString(amount) {
    return roundAmount(amount).toString();
}

/**
 * Apply rounding to all amount fields in an object recursively
 * @param {object} obj - Object containing amount fields
 * @param {array} amountFields - Array of field names that should be rounded
 * @returns {object} - Object with rounded amounts
 */
function roundAmountsInObject(obj, amountFields = [
    'amount', 'total_amount', 'final_amount', 'monthly_revenue', 'revenue',
    'refund_amount', 'dispute_amount', 'payback_amount', 'available_balance',
    'total_earnings', 'pending_amount', 'withdrawal_amount', 'base_price',
    'current_period_revenue', 'previous_period_revenue', 'total_revenue',
    'average_booking_value', 'total_spent', 'growth_percentage'
]) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => roundAmountsInObject(item, amountFields));
    }
    
    const rounded = { ...obj };
    
    for (const key in rounded) {
        if (amountFields.includes(key) && typeof rounded[key] === 'number') {
            rounded[key] = roundAmount(rounded[key]);
        } else if (typeof rounded[key] === 'object') {
            rounded[key] = roundAmountsInObject(rounded[key], amountFields);
        }
    }
    
    return rounded;
}

module.exports = {
    roundAmount,
    roundAmountToString,
    roundAmountsInObject,
};



