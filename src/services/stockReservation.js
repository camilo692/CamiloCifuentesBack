const Order = require('../models/Order');
const Product = require('../models/Product');
const {
  decrementProductStock,
  incrementProductStock,
} = require('../utils/productStock');

const STOCK_RESERVE_MINUTES = Math.max(
  5,
  Number(process.env.STOCK_RESERVE_MINUTES) || 15
);

function reservationDeadline(from = new Date()) {
  return new Date(from.getTime() + STOCK_RESERVE_MINUTES * 60 * 1000);
}

async function restoreOrderStock(order) {
  if (order.pago?.stockRestored) {
    return false;
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
  return true;
}

async function reclaimOrderStock(order) {
  const reserved = [];

  for (const item of order.productos || []) {
    const updated = await decrementProductStock(
      Product,
      item.producto,
      item.cantidad,
      item.talla
    );

    if (!updated) {
      for (const reserva of reserved) {
        await incrementProductStock(
          Product,
          reserva.producto,
          reserva.cantidad,
          reserva.talla
        );
      }
      return false;
    }

    reserved.push({
      producto: item.producto,
      cantidad: item.cantidad,
      talla: item.talla,
    });
  }

  order.pago.stockRestored = false;
  return true;
}

async function expireStaleReservations() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - STOCK_RESERVE_MINUTES * 60 * 1000);
  const stale = await Order.find({
    metodoPago: 'wompi',
    'pago.estado': { $in: ['en_cola', 'procesando'] },
    'pago.stockRestored': { $ne: true },
    $or: [
      { 'pago.reservadoHasta': { $lte: now } },
      { 'pago.reservadoHasta': null, fechaCreacion: { $lte: cutoff } },
    ],
  });

  let released = 0;
  for (const order of stale) {
    await restoreOrderStock(order);
    order.pago.estado = 'fallido';
    order.pago.ultimoError = 'reserva_expirada';
    if (order.estado === 'pendiente') {
      order.estado = 'cancelada';
    }
    await order.save();
    released += 1;
  }

  return released;
}

let expireInFlight = false;
async function expireStaleReservationsSafe() {
  if (expireInFlight) return 0;
  expireInFlight = true;
  try {
    return await expireStaleReservations();
  } catch (error) {
    console.error('expireStaleReservations:', error.message);
    return 0;
  } finally {
    expireInFlight = false;
  }
}

function startReservationExpiryJob() {
  const tickMs = 60 * 1000;
  expireStaleReservationsSafe();
  return setInterval(expireStaleReservationsSafe, tickMs);
}

module.exports = {
  STOCK_RESERVE_MINUTES,
  reservationDeadline,
  restoreOrderStock,
  reclaimOrderStock,
  expireStaleReservations,
  expireStaleReservationsSafe,
  startReservationExpiryJob,
};
