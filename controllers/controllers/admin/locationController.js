const {
    State,
    City,
    Destination,
    BoardingPoint,
    Mapping,
    Trek,
} = require("../../models");
const { Op, fn, col, where } = require("sequelize");

// States Management
const getStates = async (req, res) => {
    try {
        const states = await State.findAll({
            order: [["name", "ASC"]],
        });

        res.json({
            success: true,
            data: states,
        });
    } catch (error) {
        console.error("Error fetching states:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch states",
            error: error.message,
        });
    }
};

const getStateById = async (req, res) => {
    try {
        const { id } = req.params;
        const state = await State.findByPk(id);

        if (!state) {
            return res.status(404).json({
                success: false,
                message: "State not found",
            });
        }

        res.json({
            success: true,
            data: state,
        });
    } catch (error) {
        console.error("Error fetching state:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch state",
            error: error.message,
        });
    }
};

const createState = async (req, res) => {
    try {
        const { name, status, description } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "State name is required",
            });
        }

        const existingState = await State.findOne({
            where: {
                name: {
                    [Op.like]: name.toLowerCase(),
                },
            },
        });

        if (existingState) {
            return res.status(400).json({
                success: false,
                message: "State with this name already exists",
            });
        }

        const state = await State.create({
            name,
            status: status || "active",
            description,
        });

        res.status(201).json({
            success: true,
            data: state,
            message: "State created successfully",
        });
    } catch (error) {
        console.error("Error creating state:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create state",
            error: error.message,
        });
    }
};

const updateState = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, status, description } = req.body;

        const state = await State.findByPk(id);

        if (!state) {
            return res.status(404).json({
                success: false,
                message: "State not found",
            });
        }

        if (name) {
            const existingState = await State.findOne({
                where: {
                    name: { [Op.like]: name.toLowerCase() },
                    id: { [Op.ne]: id },
                },
            });

            if (existingState) {
                return res.status(400).json({
                    success: false,
                    message: "State with this name already exists",
                });
            }
        }

        await state.update({
            name: name || state.name,
            status: status || state.status,
            description:
                description !== undefined ? description : state.description,
        });

        res.json({
            success: true,
            data: state,
            message: "State updated successfully",
        });
    } catch (error) {
        console.error("Error updating state:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update state",
            error: error.message,
        });
    }
};

const deleteState = async (req, res) => {
    try {
        const { id } = req.params;

        const state = await State.findByPk(id);

        if (!state) {
            return res.status(404).json({
                success: false,
                message: "State not found",
            });
        }

        // Check if state has associated cities
        const citiesCount = await City.count({
            where: { state_id: id },
        });

        if (citiesCount > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete state with associated cities",
            });
        }

        await state.destroy();

        res.json({
            success: true,
            message: "State deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting state:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete state",
            error: error.message,
        });
    }
};

// Cities Management
const getCities = async (req, res) => {
    try {
        const cities = await City.findAll({
            include: [
                {
                    model: State,
                    as: "state",
                    attributes: ["id", "name"],
                },
                {
                    model: require("../../models").BoardingPoint,
                    as: "boardingPoints",
                    attributes: ["id", "name"],
                },
            ],
            order: [["cityName", "ASC"]],
        });

        res.json({
            success: true,
            data: cities,
        });
    } catch (error) {
        console.error("Error fetching cities:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch cities",
            error: error.message,
        });
    }
};

const getCityById = async (req, res) => {
    try {
        const { id } = req.params;
        const city = await City.findByPk(id, {
            include: [
                {
                    model: State,
                    as: "state",
                    attributes: ["id", "name"],
                },
                {
                    model: require("../../models").BoardingPoint,
                    as: "boardingPoints",
                    attributes: ["id", "name"],
                },
            ],
        });

        if (!city) {
            return res.status(404).json({
                success: false,
                message: "City not found",
            });
        }

        res.json({
            success: true,
            data: city,
        });
    } catch (error) {
        console.error("Error fetching city:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch city",
            error: error.message,
        });
    }
};

const createCity = async (req, res) => {
    try {
        const {
            city_name,
            state_id,
            is_popular,
            status,
            description,
            boarding_points,
        } = req.body;

        if (!city_name || !state_id) {
            return res.status(400).json({
                success: false,
                message: "City name and state are required",
            });
        }

        const existingCity = await City.findOne({
            where: { cityName: { [Op.like]: city_name.toLowerCase() } },
        });

        if (existingCity) {
            return res.status(400).json({
                success: false,
                message: "City with this name already exists",
            });
        }

        const city = await City.create({
            cityName: city_name,
            stateId: state_id,
            isPopular: is_popular || false,
            status: status || "active",
            description,
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

        res.status(201).json({
            success: true,
            data: cityWithBoardingPoints,
            message: "City created successfully",
        });
    } catch (error) {
        console.error("Error creating city:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create city",
            error: error.message,
        });
    }
};

const updateCity = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            city_name,
            state_id,
            is_popular,
            status,
            description,
            boarding_points,
        } = req.body;

        const city = await City.findByPk(id);

        if (!city) {
            return res.status(404).json({
                success: false,
                message: "City not found",
            });
        }

        if (city_name) {
            const existingCity = await City.findOne({
                where: {
                    cityName: { [Op.like]: city_name.toLowerCase() },
                    id: { [Op.ne]: id },
                },
            });

            if (existingCity) {
                return res.status(400).json({
                    success: false,
                    message: "City with this name already exists",
                });
            }
        }

        await city.update({
            cityName: city_name || city.cityName,
            stateId: state_id || city.stateId,
            isPopular: is_popular !== undefined ? is_popular : city.isPopular,
            status: status || city.status,
            description:
                description !== undefined ? description : city.description,
        });

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

        res.json({
            success: true,
            data: cityWithBoardingPoints,
            message: "City updated successfully",
        });
    } catch (error) {
        console.error("Error updating city:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update city",
            error: error.message,
        });
    }
};

const deleteCity = async (req, res) => {
    try {
        const { id } = req.params;

        const city = await City.findByPk(id);

        if (!city) {
            return res.status(404).json({
                success: false,
                message: "City not found",
            });
        }

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
                    "City cannot be deleted because it is linked to existing treks. Remove associated trek mappings first.",
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

        res.json({
            success: true,
            message: "City deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting city:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete city",
            error: error.message,
        });
    }
};

// Destinations Management
const getDestinations = async (req, res) => {
    try {
        const destinations = await Destination.findAll({
            order: [["name", "ASC"]],
        });

        res.json({
            success: true,
            data: destinations,
        });
    } catch (error) {
        console.error("Error fetching destinations:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch destinations",
            error: error.message,
        });
    }
};

const getDestinationById = async (req, res) => {
    try {
        const { id } = req.params;
        const destination = await Destination.findByPk(id);

        if (!destination) {
            return res.status(404).json({
                success: false,
                message: "Destination not found",
            });
        }

        res.json({
            success: true,
            data: destination,
        });
    } catch (error) {
        console.error("Error fetching destination:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch destination",
            error: error.message,
        });
    }
};

const createDestination = async (req, res) => {
    try {
        const { name, state, is_popular, status, description } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Destination name is required",
            });
        }

        const existingDestination = await Destination.findOne({
            where: { name: { [Op.like]: name.toLowerCase() } },
        });

        if (existingDestination) {
            return res.status(400).json({
                success: false,
                message: "Destination with this name already exists",
            });
        }

        const destination = await Destination.create({
            name,
            state,
            is_popular: is_popular || false,
            status: status || "active",
            description,
        });

        res.status(201).json({
            success: true,
            data: destination,
            message: "Destination created successfully",
        });
    } catch (error) {
        console.error("Error creating destination:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create destination",
            error: error.message,
        });
    }
};

const updateDestination = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, state, is_popular, status, description } = req.body;

        const destination = await Destination.findByPk(id);

        if (!destination) {
            return res.status(404).json({
                success: false,
                message: "Destination not found",
            });
        }

        if (name) {
            const existingDestination = await Destination.findOne({
                where: {
                    name: { [Op.like]: name.toLowerCase() },
                    id: { [Op.ne]: id },
                },
            });

            if (existingDestination) {
                return res.status(400).json({
                    success: false,
                    message: "Destination with this name already exists",
                });
            }
        }

        await destination.update({
            name: name || destination.name,
            state: state || destination.state,
            is_popular:
                is_popular !== undefined ? is_popular : destination.is_popular,
            status: status || destination.status,
            description:
                description !== undefined
                    ? description
                    : destination.description,
        });

        res.json({
            success: true,
            data: destination,
            message: "Destination updated successfully",
        });
    } catch (error) {
        console.error("Error updating destination:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update destination",
            error: error.message,
        });
    }
};

const deleteDestination = async (req, res) => {
    try {
        const { id } = req.params;

        const destination = await Destination.findByPk(id);

        if (!destination) {
            return res.status(404).json({
                success: false,
                message: "Destination not found",
            });
        }

        await destination.destroy();

        res.json({
            success: true,
            message: "Destination deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting destination:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete destination",
            error: error.message,
        });
    }
};

module.exports = {
    // States
    getStates,
    getStateById,
    createState,
    updateState,
    deleteState,

    // Cities
    getCities,
    getCityById,
    createCity,
    updateCity,
    deleteCity,

    // Destinations
    getDestinations,
    getDestinationById,
    createDestination,
    updateDestination,
    deleteDestination,
};
