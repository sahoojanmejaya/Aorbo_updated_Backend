function generateBookingId() {
  return `BK${Date.now()}`;
}

function generateDisputeId() {
  return `DSP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 1000)}`;
}

function generateId(prefix = 'ID') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

module.exports = {
  generateBookingId,
  generateDisputeId,
  generateId
};
