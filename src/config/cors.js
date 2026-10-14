function getAllowedOrigins() {
  const raw = process.env.FRONTEND_URL || process.env.CORS_ORIGINS || '';
  const fromEnv = raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  if (fromEnv.length) {
    return fromEnv;
  }

  if (process.env.NODE_ENV === 'production') {
    return [];
  }

  return ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

function createCorsOptions() {
  const allowed = getAllowedOrigins();

  return {
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      const normalized = origin.replace(/\/$/, '');
      if (allowed.includes(normalized)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}

module.exports = {
  getAllowedOrigins,
  createCorsOptions,
};
