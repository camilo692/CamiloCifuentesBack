const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const auth = require('../middlewares/auth');
const roleAuth = require('../middlewares/roleAuth');
const { productValidationRules, validate } = require('../middlewares/validators');

// Public routes
router.get('/', productController.getAllProducts);
router.get('/category/:categoryId', productController.getProductsByCategory);
router.get('/:id', productController.getProductById);

// Protected routes - require authentication
router.use(auth); // Apply auth middleware to all routes below

// Admin only routes
router.post('/', roleAuth(['admin']), productValidationRules, validate, productController.createProduct);
router.put('/:id', roleAuth(['admin']), productValidationRules, validate, productController.updateProduct);
router.delete('/:id', roleAuth(['admin']), productController.deleteProduct);

module.exports = router; 