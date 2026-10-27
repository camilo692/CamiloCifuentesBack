const rateLimit = require('express-rate-limit');

const tooMany = (_req, res) => {
  res.status(429).json({
    message: 'Demasiadas solicitudes. Espera unos minutos e inténtalo de nuevo.',
  });
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany,
});

const orderCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany,
});

const lookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany,
});

const abandonLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany,
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany,
  skip: (req) => req.path === '/health',
});

module.exports = {
  loginLimiter,
  orderCreateLimiter,
  lookupLimiter,
  abandonLimiter,
  globalLimiter,
};
