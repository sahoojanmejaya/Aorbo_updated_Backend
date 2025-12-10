const { State, City, BoardingPoint, Mapping, Trek } = require("../../models");
const { fn, col, where } = require("sequelize");

// Get all states
exports.getStates = async (req, res) => {
    try {
        const states = await State.findAll({
            where: { status: "active" },
            order: [["name", "ASC"]],
            attributes: ["id", "name"],
            raw: true,
        });
        res.json({ success: true, data: states });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch states",
        });
    }
};

// Get all cities
exports.getCities = async (req, res) => {
    try {
        const cities = await City.findAll({
            include: [
                { model: State, as: "state", attributes: ["id", "name"] },
                {
                    model: BoardingPoint,
                    as: "boardingPoints",
                    attributes: ["id", "name"],
                },
            ],
            order: [["cityName", "ASC"]],
        });
        res.json({
            success: true,
            data: { cities },
        });
    } catch (err) {
        console.error("Error fetching cities:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch cities",
        });
    }
};

// Get city by ID
exports.getCityById = async (req, res) => {
    try {
        const city = await City.findByPk(req.params.id, {
            include: [
                { model: State, as: "state", attributes: ["id", "name"] },
                {
                    model: BoardingPoint,
                    as: "boardingPoints",
                    attributes: ["id", "name"],
                },
            ],
        });
        if (!city)
            return res
                .status(404)
                .json({ success: false, message: "City not found" });
        res.json({ success: true, data: city });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch city",
        });
    }
};

// Create city
exports.createCity = async (req, res) => {
    try {
        const { cityName, stateId, boarding_points, isPopular } = req.body;
        if (!cityName || !stateId)
            return res.status(400).json({
                success: false,
                message: "cityName and stateId required",
            });

        const city = await City.create({
            cityName,
            stateId,
            isPopular: isPopular || false,
        });

        // Create boarding points if provided
        if (
            boarding_points &&
            Array.isArray(boarding_points) &&
            boarding_points.length > 0
        ) {
            const boardingPointsData = boarding_points.map((point) => ({
                name: point,
                cityId: city.id,
            }));

            await BoardingPoint.bulkCreate(boardingPointsData);
        }

        // Fetch city with boarding points
        const cityWithBoardingPoints = await City.findByPk(city.id, {
            include: [
                {
                    model: BoardingPoint,
                    as: "boardingPoints",
                },
            ],
        });

        res.status(201).json({ success: true, data: cityWithBoardingPoints });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Failed to create city",
        });
    }
};

// Update city
exports.updateCity = async (req, res) => {
    try {
        const { boarding_points, ...updateData } = req.body;
        const city = await City.findByPk(req.params.id);
        if (!city)
            return res
                .status(404)
                .json({ success: false, message: "City not found" });

        await city.update(updateData);

        // Handle boarding points if provided
        if (boarding_points !== undefined) {

            // Delete existing boarding points for this city
            await BoardingPoint.destroy({ where: { cityId: city.id } });

            // Create new boarding points if provided
            if (Array.isArray(boarding_points) && boarding_points.length > 0) {
                const boardingPointsData = boarding_points.map((point) => ({
                    name: point,
                    cityId: city.id,
                }));

                await BoardingPoint.bulkCreate(boardingPointsData);
            }
        }

        // Fetch city with boarding points
        const cityWithBoardingPoints = await City.findByPk(city.id, {
            include: [
                {
                    model: BoardingPoint,
                    as: "boardingPoints",
                },
            ],
        });

        res.json({ success: true, data: cityWithBoardingPoints });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Failed to update city",
        });
    }
};

// Delete city
exports.deleteCity = async (req, res) => {
    try {
        const city = await City.findByPk(req.params.id);
        if (!city)
            return res
                .status(404)
                .json({ success: false, message: "City not found" });
        const [mappingCount, trekUsingCity] = await Promise.all([
            Mapping.count({ where: { cityId: city.id } }),
            Trek.findOne({
                attributes: ["id", "title"],
                where: where(
                    fn(
                        "JSON_CONTAINS",
                        fn("IFNULL", col("city_ids"), fn("JSON_ARRAY")),
                        JSON.stringify([city.id]),
                        "$"
                    ),
                    1
                ),
            }),
        ]);

        if (mappingCount > 0 || trekUsingCity) {
            return res.status(400).json({
                success: false,
                message:
                    "City cannot be deleted because it is linked to existing treks. Remove trek associations first.",
                details: {
                    mappingCount,
                    trek: trekUsingCity
                        ? { id: trekUsingCity.id, title: trekUsingCity.title }
                        : null,
                },
            });
        }

        await BoardingPoint.destroy({ where: { cityId: city.id } });

        await city.destroy();
        res.json({ success: true, message: "City deleted" });
    } catch (err) {
        console.error("Error deleting city:", err);
        res.status(500).json({
            success: false,
            message: "Failed to delete city",
            error: err.message,
        });
    }
};

// Get boarding points (optionally by city)
exports.getBoardingPoints = async (req, res) => {
    try {
        const where = req.params.id ? { cityId: req.params.id } : {};
        const boardingPoints = await BoardingPoint.findAll({
            where,
            include: [
                { model: City, as: "city", attributes: ["id", "cityName"] },
            ],
            order: [["name", "ASC"]],
        });
        res.json({ success: true, data: boardingPoints });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch boarding points",
        });
    }
};

// Create boarding point
exports.createBoardingPoint = async (req, res) => {
    try {
        const { cityId, name } = req.body;
        if (!cityId || !name)
            return res.status(400).json({
                success: false,
                message: "cityId and name required",
            });

        const boardingPoint = await BoardingPoint.create({ cityId, name });

        // Fetch the created boarding point with city info
        const boardingPointWithCity = await BoardingPoint.findByPk(
            boardingPoint.id,
            {
                include: [
                    { model: City, as: "city", attributes: ["id", "cityName"] },
                ],
            }
        );

        res.status(201).json({ success: true, data: boardingPointWithCity });
    } catch (err) {
        console.error("Error creating boarding point:", err);
        res.status(500).json({
            success: false,
            message: "Failed to create boarding point",
        });
    }
};

// Update boarding point
exports.updateBoardingPoint = async (req, res) => {
    try {
        const boardingPoint = await BoardingPoint.findByPk(req.params.id);
        if (!boardingPoint)
            return res
                .status(404)
                .json({ success: false, message: "Boarding point not found" });
        await boardingPoint.update(req.body);
        res.json({ success: true, data: boardingPoint });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Failed to update boarding point",
        });
    }
};

// Delete boarding point
exports.deleteBoardingPoint = async (req, res) => {
    try {
        const boardingPoint = await BoardingPoint.findByPk(req.params.id);
        if (!boardingPoint)
            return res
                .status(404)
                .json({ success: false, message: "Boarding point not found" });
        await boardingPoint.destroy();
        res.json({ success: true, message: "Boarding point deleted" });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Failed to delete boarding point",
        });
    }
};

// Search cities
exports.searchCities = async (req, res) => {
    try {
        const { q: searchTerm, limit = 10 } = req.query;

        if (!searchTerm || searchTerm.trim() === "") {
            return res.json({ success: true, data: { cities: [] } });
        }

        const cities = await City.findAll({
            where: require("sequelize").literal(
                `LOWER(city_name) LIKE LOWER('%${searchTerm}%')`
            ),
            include: [
                { model: State, as: "state", attributes: ["id", "name"] },
                {
                    model: require("../../models").BoardingPoint,
                    as: "boardingPoints",
                    attributes: ["id", "name"],
                },
            ],
            order: [["cityName", "ASC"]],
            limit: parseInt(limit),
        });

        res.json({
            success: true,
            data: { cities },
        });
    } catch (err) {
        console.error("Error searching cities:", err);
        res.status(500).json({
            success: false,
            message: "Failed to search cities",
        });
    }
};
