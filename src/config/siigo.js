const SIIGO_BASE_URL = 'https://api.siigo.com';

function isSiigoEnabled() {
  return String(process.env.SIIGO_ENABLED || '').toLowerCase() === 'true';
}

function getSiigoConfig() {
  const username = process.env.SIIGO_USERNAME;
  const accessKey = process.env.SIIGO_ACCESS_KEY;
  const partnerId = process.env.SIIGO_PARTNER_ID;
  const documentId = Number(process.env.SIIGO_DOCUMENT_ID);
  const sellerId = Number(process.env.SIIGO_SELLER_ID);
  const paymentTypeId = Number(process.env.SIIGO_PAYMENT_TYPE_ID);
  const productCode = process.env.SIIGO_PRODUCT_CODE;
  const shippingCode = process.env.SIIGO_SHIPPING_CODE || productCode;
  const taxId = process.env.SIIGO_TAX_ID ? Number(process.env.SIIGO_TAX_ID) : null;

  const missing = [];
  if (!username) missing.push('SIIGO_USERNAME');
  if (!accessKey) missing.push('SIIGO_ACCESS_KEY');
  if (!partnerId) missing.push('SIIGO_PARTNER_ID');
  if (!documentId) missing.push('SIIGO_DOCUMENT_ID');
  if (!sellerId) missing.push('SIIGO_SELLER_ID');
  if (!paymentTypeId) missing.push('SIIGO_PAYMENT_TYPE_ID');
  if (!productCode) missing.push('SIIGO_PRODUCT_CODE');

  if (missing.length) {
    throw new Error(`Faltan variables de Siigo: ${missing.join(', ')}`);
  }

  return {
    baseUrl: SIIGO_BASE_URL,
    username,
    accessKey,
    partnerId,
    documentId,
    sellerId,
    paymentTypeId,
    productCode,
    shippingCode,
    taxId,
    stamp: String(process.env.SIIGO_STAMP || 'true').toLowerCase() !== 'false',
    sendMail: String(process.env.SIIGO_SEND_MAIL || 'true').toLowerCase() !== 'false',
  };
}

function getSiigoPublicStatus() {
  const enabled = isSiigoEnabled();
  const missing = [];
  if (!process.env.SIIGO_USERNAME) missing.push('SIIGO_USERNAME');
  if (!process.env.SIIGO_ACCESS_KEY) missing.push('SIIGO_ACCESS_KEY');
  if (!process.env.SIIGO_PARTNER_ID) missing.push('SIIGO_PARTNER_ID');
  if (!process.env.SIIGO_DOCUMENT_ID) missing.push('SIIGO_DOCUMENT_ID');
  if (!process.env.SIIGO_SELLER_ID) missing.push('SIIGO_SELLER_ID');
  if (!process.env.SIIGO_PAYMENT_TYPE_ID) missing.push('SIIGO_PAYMENT_TYPE_ID');
  if (!process.env.SIIGO_PRODUCT_CODE) missing.push('SIIGO_PRODUCT_CODE');

  return {
    enabled,
    configured: missing.length === 0,
    missing,
    partnerId: process.env.SIIGO_PARTNER_ID || '',
    username: process.env.SIIGO_USERNAME || '',
    documentId: process.env.SIIGO_DOCUMENT_ID || '',
    sellerId: process.env.SIIGO_SELLER_ID || '',
    paymentTypeId: process.env.SIIGO_PAYMENT_TYPE_ID || '',
    productCode: process.env.SIIGO_PRODUCT_CODE || '',
    shippingCode: process.env.SIIGO_SHIPPING_CODE || process.env.SIIGO_PRODUCT_CODE || '',
    taxId: process.env.SIIGO_TAX_ID || '',
    taxLabel: process.env.SIIGO_TAX_ID === '14779' ? 'IVA 19%' : (process.env.SIIGO_TAX_ID ? `Impuesto ${process.env.SIIGO_TAX_ID}` : 'Sin impuesto'),
    stamp: String(process.env.SIIGO_STAMP || 'true').toLowerCase() !== 'false',
    sendMail: String(process.env.SIIGO_SEND_MAIL || 'true').toLowerCase() !== 'false',
  };
}

module.exports = {
  SIIGO_BASE_URL,
  isSiigoEnabled,
  getSiigoConfig,
  getSiigoPublicStatus,
};
