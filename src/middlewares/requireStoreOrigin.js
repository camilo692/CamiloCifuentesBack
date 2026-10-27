const { getAllowedOrigins } = require('../config/cors');

function requireStoreOrigin(req, res, next) {
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  const allowed = getAllowedOrigins();
  const origin = String(req.get('origin') || '').replace(/\/$/, '');
  const referer = String(req.get('referer') || '');

  if (origin && allowed.includes(origin)) {
    return next();
  }

  if (referer && allowed.some((allowedOrigin) => referer.startsWith(allowedOrigin))) {
    return next();
  }

  return res.status(403).json({ message: 'Origen no permitido' });
}

module.exports = requireStoreOrigin;
