const crypto = require('crypto');
const Order = require('../models/Order');
const { emitirFacturaSiigo } = require('./orderSiigo');
const { getWompiConfig } = require('../config/wompi');
const { restoreOrderStock } = require('./stockReservation');

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

function isReservationExpired(order) {
  if (order.pago?.stockRestored) return true;
  if (order.pago?.estado === 'fallido') return true;
  if (order.estado === 'cancelada') return true;
  if (order.pago?.reservadoHasta && Date.now() > new Date(order.pago.reservadoHasta).getTime()) {
    return true;
  }
  return false;
}

function wompiApiBase(publicKey) {
  return String(publicKey || '').startsWith('pub_test')
    ? 'https://sandbox.wompi.co/v1'
    : 'https://production.wompi.co/v1';
}

async function voidWompiTransaction(transactionId) {
  if (!transactionId) return false;
  const config = getWompiConfig();
  if (!config.privateKey) return false;

  const base = wompiApiBase(config.publicKey);
  try {
    const voidRes = await fetch(`${base}/transactions/${transactionId}/void`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.privateKey}`,
        'Content-Type': 'application/json',
      },
    });
    if (voidRes.ok) return true;

    const refundRes = await fetch(`${base}/transactions/${transactionId}/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.privateKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    return refundRes.ok;
  } catch (error) {
    console.error('Wompi void/refund:', error.message);
    return false;
  }
}

async function rejectExpiredPayment(order, transaction) {
  await restoreOrderStock(order);
  if (transaction?.id) {
    await voidWompiTransaction(transaction.id);
  }
  order.pago.estado = 'fallido';
  order.pago.ultimoError = 'reserva_expirada';
  if (order.estado === 'pendiente' || order.estado === 'confirmada') {
    order.estado = 'cancelada';
  }
  await order.save();
  return { ok: true, expired: true, orderId: String(order._id) };
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
    if (isReservationExpired(order)) {
      return rejectExpiredPayment(order, transaction);
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

  if (isReservationExpired(order)) {
    return rejectExpiredPayment(order, transaction);
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
