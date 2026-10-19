const express = require('express');
const wompiController = require('../controllers/wompiController');

const router = express.Router();

router.post('/wompi', wompiController.handleEvent);

module.exports = router;
