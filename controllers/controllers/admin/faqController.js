const { FAQ ,FaqCategory } = require("../../models");
const { Op, fn, col } = require("sequelize");

// ➕ Add FAQ
exports.createFAQ = async (req, res) => {
  //try {
    const { category_id, question, answer, role_type, status, top_list ,tag} = req.body;

    if (!category_id || !question || !answer || !role_type) {
      return res.status(400).json({
        success: false,
        message: "category_id, question, answer, role_type are required"
      });
    }

    const category = await FaqCategory.findByPk(category_id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    const faq = await FAQ.create({
      category_id,
      tag,
      question,
      answer,
      role_type,
      status: status || "DRAFT",
      top_list: top_list || false
    });

    res.status(201).json({
      success: true,
      message: "FAQ created successfully",
      data: faq
    });
  /*} catch (error) {
    console.error("Create FAQ Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }*/
};


// 📄 Get All FAQs (with optional filters)
// 📄 Get All FAQs (with filters + status counts)
exports.getAllFAQs = async (req, res) => {
  const { role_type, category_id, status, top_list } = req.query;

  let where = {};

  if (role_type) where.role_type = role_type;
  if (category_id) where.category_id = category_id;
  if (status) where.status = status;
  if (top_list !== undefined) where.top_list = top_list === "true";

  // 🔹 1. Get filtered FAQ list
  const faqs = await FAQ.findAll({
    where,
    include: [
      {
        model: FaqCategory,
        as: "category",
        attributes: ["id", "name", "colors", "folder_name"]
      }
    ],
    order: [["id", "DESC"]]
  });

  // 🔹 2. Get status wise counts (no filter except role/category if needed)
  let countWhere = {};
  if (role_type) countWhere.role_type = role_type;
  if (category_id) countWhere.category_id = category_id;

  const statusCountsRaw = await FAQ.findAll({
    attributes: [
      "status",
      [fn("COUNT", col("status")), "count"]
    ],
    where: countWhere,
    group: ["status"]
  });

  // 🔹 3. Format counts
  const counts = {
    LIVE: 0,
    DRAFT: 0,
    ARCHIVE: 0,
    AUDIT: 0
  };

  statusCountsRaw.forEach(item => {
    counts[item.status] = parseInt(item.getDataValue("count"));
  });

  // 🔹 4. Final response
  res.json({
    success: true,
    data: faqs,
    counts
  });
};


// 📄 Get Single FAQ
exports.getFAQById = async (req, res) => {
  try {
    const faq = await FAQ.findByPk(req.params.id, {
      include: [
        {
          model: FaqCategory,
          as: "category",
          attributes: ["id", "name"]
        }
      ]
    });

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found"
      });
    }

    res.json({
      success: true,
      data: faq
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// ✏️ Update FAQ
exports.updateFAQ = async (req, res) => {
  try {
    const { category_id, question, answer, role_type, status, top_list,tag } = req.body;

    const faq = await FAQ.findByPk(req.params.id);

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found"
      });
    }

    if (category_id) {
      const category = await FaqCategory.findByPk(category_id);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found"
        });
      }
    }

    await faq.update({
      category_id,
      question,
      tag,
      answer,
      role_type,
      status,
      top_list
    });

    res.json({
      success: true,
      message: "FAQ updated successfully",
      data: faq
    });
  } catch (error) {
    console.error("Update FAQ Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// 🗑️ Delete FAQ
exports.deleteFAQ = async (req, res) => {
  try {
    const faq = await FAQ.findByPk(req.params.id);

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found"
      });
    }

    await faq.destroy();

    res.json({
      success: true,
      message: "FAQ deleted successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



exports.createCategory = async (req, res) => {
  try {
    const { name, folder_name, colors, display_limit, status } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required"
      });
    }

    const category = await FaqCategory.create({
      name,
      folder_name,
      colors,
      display_limit,
      status: status || "ACTIVE"
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category
    });
  } catch (error) {
    console.error("Create Category Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.getAllCategories = async (req, res) => {
  try {
    const { status } = req.query;

    let where = {};
    if (status) where.status = status;

    const categories = await FaqCategory.findAll({
      where,
      order: [["id", "DESC"]]
    });

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error("Get Categories Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, folder_name, colors, display_limit, status } = req.body;

    const category = await FaqCategory.findByPk(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    await category.update({
      name,
      folder_name,
      colors,
      display_limit,
      status
    });

    res.json({
      success: true,
      message: "Category updated successfully",
      data: category
    });
  } catch (error) {
    console.error("Update Category Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await FaqCategory.findByPk(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    await category.destroy();

    res.json({
      success: true,
      message: "Category deleted successfully"
    });
  } catch (error) {
    console.error("Delete Category Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};



exports.bulkUpdateFaqStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "ids array is required" });
    }

    if (!status) {
      return res.status(400).json({ success: false, message: "status is required" });
    }

    await FAQ.update(
      { status },
      { where: { id: ids } }
    );

    res.json({
      success: true,
      message: "Status updated successfully"
    });

  } catch (error) {
    console.error("Bulk Status Update Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.bulkMoveFaqCategory = async (req, res) => {
  try {
    const { ids, category_id } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "ids array is required" });
    }

    if (!category_id) {
      return res.status(400).json({ success: false, message: "category_id is required" });
    }

    // Optional: check category exists
    const category = await FaqCategory.findByPk(category_id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    await FAQ.update(
      { category_id },
      { where: { id: ids } }
    );

    res.json({
      success: true,
      message: "FAQs moved to new category successfully"
    });

  } catch (error) {
    console.error("Bulk Move Category Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.bulkDeleteFaqs = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "ids array is required" });
    }

    await FAQ.destroy({
      where: { id: ids }
    });

    res.json({
      success: true,
      message: "FAQs deleted successfully"
    });

  } catch (error) {
    console.error("Bulk Delete Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
