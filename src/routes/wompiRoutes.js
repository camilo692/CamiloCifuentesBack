const express = require('express');
const wompiController = require('../controllers/wompiController');

const router = express.Router();

// Wompi valida la URL de eventos con GET; el cobro real llega por POST.
router.get('/wompi', (req, res) => {
  res.status(200).json({ ok: true });
});
router.post('/wompi', wompiController.handleEvent);

module.exports = router;
