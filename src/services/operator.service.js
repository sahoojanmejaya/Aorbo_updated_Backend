const operatorRepo = require("../repositories/operator.repo");

/**
 * Get All Operators
 */
async function getAllOperators(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = query.search || '';

    return await operatorRepo.findAll({ limit, offset, search });
}

/**
 * Get Operator By ID
 */
async function getOperatorById(id) {
    const operator = await operatorRepo.findById(id);

    if (!operator) {
        throw {
            statusCode: 404,
            message: "Resource not found",
            errors: { id: "Operator not found" }
        };
    }

    return operator;
}

module.exports = {
    getAllOperators,
    getOperatorById
};
