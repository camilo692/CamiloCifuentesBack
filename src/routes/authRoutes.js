const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middlewares/auth');
const authOrMfaSetup = require('../middlewares/authOrMfaSetup');
const { loginLimiter } = require('../middlewares/rateLimits');

router.post('/login', loginLimiter, authController.login);
router.get('/profile', auth, authController.getProfile);
router.get('/mfa/setup', loginLimiter, authOrMfaSetup, authController.setupMfa);
router.post('/mfa/enable', loginLimiter, authOrMfaSetup, authController.enableMfa);

module.exports = router;
