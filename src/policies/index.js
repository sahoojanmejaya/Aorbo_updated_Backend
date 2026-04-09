const standardPolicy = require("./standard.policy");
const flexiblePolicy = require("./flexible.policy");

function calculateCancellation(policyType, context) {
  switch (policyType) {
    case "STANDARD":
      return standardPolicy(context);

    case "FLEXIBLE":
      return flexiblePolicy(context);

    default:
      throw {
        statusCode: 400,
        message: "Unsupported cancellation policy",
        errors: { policyType }
      };
  }
}

module.exports = {
  calculateCancellation
};
