function isOrderEmailEnabled() {
  return (
    String(process.env.ORDER_EMAIL_ENABLED || '').toLowerCase() === 'true' &&
    Boolean(String(process.env.ORDER_EMAIL_FROM || '').trim())
  );
}

function getOrderEmailConfig() {
  const from = String(process.env.ORDER_EMAIL_FROM || '').trim();
  const replyTo = String(process.env.ORDER_EMAIL_REPLY_TO || '').trim();
  const region = process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-2';
  const storeUrl = String(process.env.STORE_URL || process.env.FRONTEND_URL || '')
    .split(',')[0]
    .trim()
    .replace(/\/$/, '');

  if (!from) {
    throw new Error('Falta ORDER_EMAIL_FROM');
  }

  return {
    from,
    replyTo,
    region,
    storeUrl: storeUrl || 'https://camilocifuentesstore.com',
  };
}

module.exports = {
  isOrderEmailEnabled,
  getOrderEmailConfig,
};
