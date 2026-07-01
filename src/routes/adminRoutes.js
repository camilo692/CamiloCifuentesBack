const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middlewares/auth');
const roleAuth = require('../middlewares/roleAuth');

router.use(auth, roleAuth(['admin']));

router.get('/stats', adminController.getStats);

module.exports = router;
