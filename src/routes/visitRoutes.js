const express = require('express');
const { visitLimiter } = require('../middlewares/rateLimits');
const { visitController } = require('../controllers/visitController');

const router = express.Router();

router.post('/', visitLimiter, visitController.track);

module.exports = router;
