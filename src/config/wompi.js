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
    publicKey: process.env.WOMPI_PUBLIC_KEY || '',
    privateKey: process.env.WOMPI_PRIVATE_KEY || '',
    integritySecret: process.env.WOMPI_INTEGRITY_SECRET || '',
    eventsSecret: process.env.WOMPI_EVENTS_SECRET || '',
    redirectUrl:
      process.env.WOMPI_REDIRECT_URL || `${firstFrontend}/tienda/confirmacion`,
    currency: 'COP',
  };
}

module.exports = {
  isWompiEnabled,
  getWompiConfig,
};
