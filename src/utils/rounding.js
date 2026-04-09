function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

module.exports = round;

