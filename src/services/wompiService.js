const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { incrementProductStock } = require('../utils/productStock');
const { emitirFacturaSiigo } = require('./orderSiigo');
const { getWompiConfig } = require('../config/wompi');

function pesosToCents(pesos) {
  return Math.round(Number(pesos || 0) * 100);
}

function buildIntegritySignature(reference, amountInCents, currency, secret) {
  const raw = `${reference}${amountInCents}${currency}${secret}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function buildWompiCheckout(order) {
  const config = getWompiConfig();
  const reference = String(order._id);
  const amountInCents = pesosToCents(order.total);
  const integrity = buildIntegritySignature(
    reference,
    amountInCents,
    config.currency,
    config.integritySecret
  );

  return {
    publicKey: config.publicKey,
    currency: config.currency,
    amountInCents,
    reference,
    integrity,
    redirectUrl: config.redirectUrl,
    customerEmail: order.cliente?.email || '',
  };
}

function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function verifyWompiEvent(payload, checksumHeader) {
  const { eventsSecret } = getWompiConfig();
  if (!eventsSecret || !payload?.signature) {
    return false;
  }

  const properties = payload.signature.properties || [];
  const values = properties.map((path) => getByPath(payload.data, path)).join('');
  const raw = `${values}${payload.timestamp}${eventsSecret}`;
  const digest = crypto.createHash('sha256').update(raw).digest('hex');
  const expected = String(payload.signature.checksum || checksumHeader || '');

  if (!expected || digest.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(expected));
}

async function restoreOrderStock(order) {
  if (order.pago?.stockRestored) {
    return;
  }

  for (const item of order.productos || []) {
    await incrementProductStock(
      Product,
      item.producto,
      item.cantidad,
      item.talla
    );
  }

  order.pago.stockRestored = true;
}

async function applyWompiTransaction(transaction) {
  const reference = transaction?.reference;
  const status = transaction?.status;
  const amountInCents = Number(transaction?.amount_in_cents);
  const currency = transaction?.currency;

  if (!reference) {
    return { skipped: true, reason: 'sin referencia' };
  }

  const order = await Order.findById(reference);
  if (!order) {
    return { skipped: true, reason: 'orden no encontrada' };
  }

  const expectedCents = order.pago?.amountInCents || pesosToCents(order.total);
  if (currency && currency !== 'COP') {
    return { skipped: true, reason: 'moneda inválida' };
  }
  if (Number.isFinite(amountInCents) && amountInCents !== expectedCents) {
    return { skipped: true, reason: 'monto no coincide' };
  }

  order.pago.transactionId = transaction.id || order.pago.transactionId;
  order.pago.proveedor = 'wompi';
  order.pago.intentos = (order.pago.intentos || 0) + 1;
  order.pago.processedAt = new Date();

  if (status === 'APPROVED') {
    if (order.pago.estado === 'completado') {
      return { skipped: true, reason: 'ya cobrada' };
    }
    order.pago.estado = 'completado';
    order.pago.ultimoError = '';
    await order.save();
    await emitirFacturaSiigo(order);
    return { ok: true, status, orderId: String(order._id) };
  }

  if (['DECLINED', 'VOIDED', 'ERROR'].includes(status)) {
    if (order.pago.estado === 'completado') {
      return { skipped: true, reason: 'ya cobrada, no se revierte' };
    }
    if (order.pago.estado !== 'fallido') {
      await restoreOrderStock(order);
    }
    order.pago.estado = 'fallido';
    order.pago.ultimoError = status;
    await order.save();
    return { ok: true, status, orderId: String(order._id) };
  }

  order.pago.estado = 'procesando';
  await order.save();
  return { ok: true, status: status || 'PENDING', orderId: String(order._id) };
}

module.exports = {
  pesosToCents,
  buildWompiCheckout,
  verifyWompiEvent,
  applyWompiTransaction,
};
