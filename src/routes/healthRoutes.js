const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/health', async (req, res) => {
  const mongoState = mongoose.connection.readyState;
  const mongoUp = mongoState === 1;

  const payload = {
    status: mongoUp ? 'ok' : 'degraded',
    uptime: process.uptime(),
    mongodb: mongoUp ? 'up' : 'down',
  };

  res.status(mongoUp ? 200 : 503).json(payload);
});

module.exports = router;
