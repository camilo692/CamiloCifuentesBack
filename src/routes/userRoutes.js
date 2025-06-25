const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middlewares/auth');
const roleAuth = require('../middlewares/roleAuth');
const { userValidationRules, validate } = require('../middlewares/validators');

// Protected routes - require authentication
router.use(auth); // Apply auth middleware to all routes below

// Admin only routes
router.post('/register', roleAuth(['admin']), userValidationRules, validate, userController.createUser);
router.get('/', roleAuth(['admin']), userController.getAllUsers);
router.get('/:id', roleAuth(['admin']), userController.getUserById);
router.put('/:id', roleAuth(['admin']), userValidationRules, validate, userController.updateUser);
router.delete('/:id', roleAuth(['admin']), userController.deleteUser);

// User routes (authenticated users)
router.get('/profile', userController.getProfile);
router.put('/profile', userValidationRules, validate, userController.updateProfile);

module.exports = router; 