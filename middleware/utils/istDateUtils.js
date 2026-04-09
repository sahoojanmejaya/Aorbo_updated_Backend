/**
 * IST (Indian Standard Time) Date Utilities
 * Centralized timezone handling for consistent date operations across the application
 */

const IST_TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET = '+05:30';

/**
 * Get current date and time in IST
 * @returns {Date} Current date in IST
 */
const getCurrentISTDate = () => {
    return new Date(new Date().toLocaleString("en-US", { timeZone: IST_TIMEZONE }));
};

/**
 * Convert any date to IST
 * @param {Date|string} date - Date to convert
 * @returns {Date} Date in IST
 */
const toISTDate = (date) => {
    const inputDate = new Date(date);
    return new Date(inputDate.toLocaleString("en-US", { timeZone: IST_TIMEZONE }));
};

/**
 * Format date to YYYY-MM-DD in IST
 * @param {Date|string} date - Date to format
 * @returns {string} Date in YYYY-MM-DD format (IST)
 */
const formatISTDate = (date = new Date()) => {
    const istDate = toISTDate(date);
    const year = istDate.getFullYear();
    const month = String(istDate.getMonth() + 1).padStart(2, '0');
    const day = String(istDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Format date to YYYY-MM-DD HH:MM:SS in IST
 * @param {Date|string} date - Date to format
 * @returns {string} DateTime in YYYY-MM-DD HH:MM:SS format (IST)
 */
const formatISTDateTime = (date = new Date()) => {
    const istDate = toISTDate(date);
    const year = istDate.getFullYear();
    const month = String(istDate.getMonth() + 1).padStart(2, '0');
    const day = String(istDate.getDate()).padStart(2, '0');
    const hours = String(istDate.getHours()).padStart(2, '0');
    const minutes = String(istDate.getMinutes()).padStart(2, '0');
    const seconds = String(istDate.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * Parse date string and return IST date
 * @param {string} dateString - Date string (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
 * @returns {Date} Parsed date in IST
 */
const parseISTDate = (dateString) => {
    if (!dateString) return null;

    // If date string doesn't include time, assume midnight IST
    const dateTimeString = dateString.includes(' ') ? dateString : `${dateString} 00:00:00`;

    // Create date assuming it's in IST
    const [datePart, timePart] = dateTimeString.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds] = (timePart || '00:00:00').split(':').map(Number);

    // Create date in IST
    return new Date(year, month - 1, day, hours, minutes, seconds);
};

/**
 * Add days to a date in IST
 * @param {Date|string} date - Base date
 * @param {number} days - Number of days to add
 * @returns {Date} New date in IST
 */
const addDaysIST = (date, days) => {
    const istDate = toISTDate(date);
    istDate.setDate(istDate.getDate() + days);
    return istDate;
};

/**
 * Calculate difference in days between two dates in IST
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @returns {number} Difference in days
 */
const daysDifferenceIST = (startDate, endDate) => {
    const start = toISTDate(startDate);
    const end = toISTDate(endDate);

    // Reset time to start of day for accurate day calculation
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const diffTime = end.getTime() - start.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Check if a date is today in IST
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if date is today in IST
 */
const isToday = (date) => {
    const today = formatISTDate();
    const checkDate = formatISTDate(date);
    return today === checkDate;
};

/**
 * Check if a date is in the past in IST
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if date is in the past
 */
const isPast = (date) => {
    const today = getCurrentISTDate();
    const checkDate = toISTDate(date);
    checkDate.setHours(23, 59, 59, 999); // End of day for comparison
    return checkDate < today;
};

/**
 * Check if a date is in the future in IST
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if date is in the future
 */
const isFuture = (date) => {
    const today = getCurrentISTDate();
    const checkDate = toISTDate(date);
    checkDate.setHours(0, 0, 0, 0); // Start of day for comparison
    return checkDate > today;
};

/**
 * Get start of day in IST
 * @param {Date|string} date - Date
 * @returns {Date} Start of day in IST
 */
const startOfDayIST = (date = new Date()) => {
    const istDate = toISTDate(date);
    istDate.setHours(0, 0, 0, 0);
    return istDate;
};

/**
 * Get end of day in IST
 * @param {Date|string} date - Date
 * @returns {Date} End of day in IST
 */
const endOfDayIST = (date = new Date()) => {
    const istDate = toISTDate(date);
    istDate.setHours(23, 59, 59, 999);
    return istDate;
};

/**
 * Format date for user display in Indian format
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date (e.g., "18 Sep 2025")
 */
const formatDisplayDate = (date) => {
    const istDate = toISTDate(date);
    return istDate.toLocaleDateString('en-IN', {
        timeZone: IST_TIMEZONE,
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

/**
 * Format date and time for user display in Indian format
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted datetime (e.g., "18 Sep 2025, 10:30 AM")
 */
const formatDisplayDateTime = (date) => {
    const istDate = toISTDate(date);
    return istDate.toLocaleString('en-IN', {
        timeZone: IST_TIMEZONE,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

module.exports = {
    IST_TIMEZONE,
    IST_OFFSET,
    getCurrentISTDate,
    toISTDate,
    formatISTDate,
    formatISTDateTime,
    parseISTDate,
    addDaysIST,
    daysDifferenceIST,
    isToday,
    isPast,
    isFuture,
    startOfDayIST,
    endOfDayIST,
    formatDisplayDate,
    formatDisplayDateTime
};