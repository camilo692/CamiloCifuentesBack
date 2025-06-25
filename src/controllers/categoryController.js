const Category = require('../models/Category');

const categoryController = {
  // Get all categories
  getAllCategories: async (req, res) => {
    try {
      const categories = await Category.find();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get category by ID
  getCategoryById: async (req, res) => {
    try {
      const category = await Category.findById(req.params.id);
      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Create new category
  createCategory: async (req, res) => {
    try {
      const { name, description, image } = req.body;
      const category = new Category({
        name,
        description,
        image
      });
      const newCategory = await category.save();
      res.status(201).json(newCategory);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // Update category
  updateCategory: async (req, res) => {
    try {
      const { name, description, image, isActive } = req.body;
      const category = await Category.findById(req.params.id);
      
      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }

      if (name) category.name = name;
      if (description) category.description = description;
      if (image) category.image = image;
      if (typeof isActive === 'boolean') category.isActive = isActive;

      const updatedCategory = await category.save();
      res.json(updatedCategory);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // Delete category
  deleteCategory: async (req, res) => {
    try {
      const category = await Category.findById(req.params.id);
      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }
      await category.deleteOne();
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = categoryController; 