const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const auth = require('../middlewares/auth');
const roleAuth = require('../middlewares/roleAuth');
const { categoryValidationRules, validate } = require('../middlewares/validators');

// Public routes
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);

// Protected routes - require authentication
router.use(auth); // Apply auth middleware to all routes below

// Admin only routes
router.post('/', roleAuth(['admin']), categoryValidationRules, validate, categoryController.createCategory);
router.put('/:id', roleAuth(['admin']), categoryValidationRules, validate, categoryController.updateCategory);
router.delete('/:id', roleAuth(['admin']), categoryController.deleteCategory);

module.exports = router; 