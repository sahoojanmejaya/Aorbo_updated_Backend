const service = require("../services/operator.service");
const { sendResponse } = require("../utils/response");

async function listOperators(req, res, next) {
    try {
        const data = await service.getAllOperators(req.query);
        return sendResponse(res, {
            success: true,
            data,
            message: "Operators fetched successfully",
            errors: null
        });
    } catch (err) {
        next(err);
    }
}

async function getOperatorById(req, res, next) {
    try {
        const { id } = req.params;
        const data = await service.getOperatorById(id);
        return sendResponse(res, {
            success: true,
            data,
            message: "Operator details fetched successfully",
            errors: null
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    listOperators,
    getOperatorById
};
