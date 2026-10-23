function isWompiEnabled() {
  return (
    String(process.env.PAYMENT_PROVIDER || '').toLowerCase() === 'wompi' &&
    Boolean(process.env.WOMPI_PUBLIC_KEY) &&
    Boolean(process.env.WOMPI_INTEGRITY_SECRET)
  );
}

function getWompiConfig() {
  const firstFrontend = String(process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean)[0] || 'http://localhost:3000';

  return {
    publicKey: String(process.env.WOMPI_PUBLIC_KEY || '').trim(),
    privateKey: String(process.env.WOMPI_PRIVATE_KEY || '').trim(),
    integritySecret: String(process.env.WOMPI_INTEGRITY_SECRET || '').trim(),
    eventsSecret: String(process.env.WOMPI_EVENTS_SECRET || '').trim(),
    redirectUrl:
      process.env.WOMPI_REDIRECT_URL || `${firstFrontend}/tienda/confirmacion`,
    currency: 'COP',
  };
}

module.exports = {
  isWompiEnabled,
  getWompiConfig,
};
