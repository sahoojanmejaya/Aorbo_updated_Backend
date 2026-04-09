/**
 * Convert input date/time to UTC Date object
 */
function toUTC(dateInput) {
  return new Date(new Date(dateInput).toISOString());
}

/**
 * Difference in hours (can be fractional)
 */
function diffHours(later, earlier) {
  const diffMs = later.getTime() - earlier.getTime();
  return diffMs / (1000 * 60 * 60);
}

module.exports = {
  toUTC,
  diffHours
};
