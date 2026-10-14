const Order = require('../models/Order');
const { emitirFacturaSiigo } = require('./orderSiigo');

const CLAIMABLE = ['en_cola', 'fallido'];

async function cobrarPago(order) {
  const provider = (process.env.PAYMENT_PROVIDER || 'none').toLowerCase();

  if (provider === 'none') {
    order.pago.proveedor = 'none';
    order.pago.estado = 'omitido';
    order.pago.ultimoError =
      'Pasarela no configurada. El pedido se registró; no se cobró tarjeta.';
    return { cobrado: false };
  }

  throw new Error(`Pasarela ${provider} aún no está implementada`);
}

async function processPaymentJob(orderId) {
  if (!orderId) {
    return { skipped: true, reason: 'sin orderId' };
  }

  const claimed = await Order.findOneAndUpdate(
    {
      _id: orderId,
      'pago.estado': { $in: CLAIMABLE },
    },
    {
      $set: { 'pago.estado': 'procesando' },
      $inc: { 'pago.intentos': 1 },
    },
    { new: true }
  );

  if (!claimed) {
    const existing = await Order.findById(orderId);
    if (!existing) {
      return { skipped: true, reason: 'orden no encontrada' };
    }
    return { skipped: true, reason: `ya en estado ${existing.pago?.estado || 'desconocido'}` };
  }

  try {
    await cobrarPago(claimed);
    claimed.pago.processedAt = new Date();
    await claimed.save();
    await emitirFacturaSiigo(claimed);
    return { ok: true, orderId: String(claimed._id), pago: claimed.pago.estado };
  } catch (error) {
    claimed.pago.estado = 'fallido';
    claimed.pago.ultimoError = error.message;
    claimed.pago.processedAt = new Date();
    await claimed.save();
    throw error;
  }
}

module.exports = {
  processPaymentJob,
};
