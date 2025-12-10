const { BoardingPoint, City } = require("../../models");

// Get all boarding points
exports.getBoardingPoints = async (req, res) => {
    try {
        const boardingPoints = await BoardingPoint.findAll({
            include: [
                { model: City, as: "city", attributes: ["id", "cityName"] },
            ],
            order: [["name", "ASC"]],
        });
        res.json({ success: true, data: boardingPoints });
    } catch (error) {
        console.error("Error fetching boarding points:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch boarding points",
        });
    }
};

// Get boarding points by city
exports.getBoardingPointsByCity = async (req, res) => {
    try {
        const { cityId } = req.params;
        const boardingPoints = await BoardingPoint.findAll({
            where: { cityId },
            include: [
                { model: City, as: "city", attributes: ["id", "cityName"] },
            ],
            order: [["name", "ASC"]],
        });
        res.json({ success: true, data: boardingPoints });
    } catch (error) {
        console.error("Error fetching boarding points by city:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch boarding points",
        });
    }
};

// Create boarding point
exports.createBoardingPoint = async (req, res) => {
    try {
        const { name, cityId } = req.body;

        if (!name || !cityId) {
            return res.status(400).json({
                success: false,
                message: "Name and city ID are required",
            });
        }

        // Check if city exists
        const city = await City.findByPk(cityId);
        if (!city) {
            return res.status(404).json({
                success: false,
                message: "City not found",
            });
        }

        // Check if boarding point already exists for this city
        const existingBoardingPoint = await BoardingPoint.findOne({
            where: { name, cityId },
        });

        if (existingBoardingPoint) {
            return res.status(400).json({
                success: false,
                message:
                    "Boarding point with this name already exists for this city",
            });
        }

        const boardingPoint = await BoardingPoint.create({
            name,
            cityId,
        });

        const boardingPointWithCity = await BoardingPoint.findByPk(
            boardingPoint.id,
            {
                include: [
                    { model: City, as: "city", attributes: ["id", "cityName"] },
                ],
            }
        );

        res.status(201).json({
            success: true,
            data: boardingPointWithCity,
            message: "Boarding point created successfully",
        });
    } catch (error) {
        console.error("Error creating boarding point:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create boarding point",
        });
    }
};

// Update boarding point
exports.updateBoardingPoint = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, cityId } = req.body;

        const boardingPoint = await BoardingPoint.findByPk(id);

        if (!boardingPoint) {
            return res.status(404).json({
                success: false,
                message: "Boarding point not found",
            });
        }

        // Check if city exists if cityId is being updated
        if (cityId) {
            const city = await City.findByPk(cityId);
            if (!city) {
                return res.status(404).json({
                    success: false,
                    message: "City not found",
                });
            }
        }

        // Check if boarding point with same name already exists for this city
        if (name || cityId) {
            const existingBoardingPoint = await BoardingPoint.findOne({
                where: {
                    name: name || boardingPoint.name,
                    cityId: cityId || boardingPoint.cityId,
                    id: { [require("sequelize").Op.ne]: id },
                },
            });

            if (existingBoardingPoint) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Boarding point with this name already exists for this city",
                });
            }
        }

        await boardingPoint.update({
            name: name || boardingPoint.name,
            cityId: cityId || boardingPoint.cityId,
        });

        const updatedBoardingPoint = await BoardingPoint.findByPk(id, {
            include: [
                { model: City, as: "city", attributes: ["id", "cityName"] },
            ],
        });

        res.json({
            success: true,
            data: updatedBoardingPoint,
            message: "Boarding point updated successfully",
        });
    } catch (error) {
        console.error("Error updating boarding point:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update boarding point",
        });
    }
};

// Delete boarding point
exports.deleteBoardingPoint = async (req, res) => {
    try {
        const { id } = req.params;

        const boardingPoint = await BoardingPoint.findByPk(id);

        if (!boardingPoint) {
            return res.status(404).json({
                success: false,
                message: "Boarding point not found",
            });
        }

        await boardingPoint.destroy();

        res.json({
            success: true,
            message: "Boarding point deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting boarding point:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete boarding point",
        });
    }
};
