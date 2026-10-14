const { isSiigoEnabled } = require('../config/siigo');
const {
  crearFacturaSiigo,
  mapSiigoInvoiceResult,
} = require('./siigoInvoiceService');

async function emitirFacturaSiigo(order) {
  if (!isSiigoEnabled()) {
    order.siigoFactura = {
      estado: 'omitida',
      error: 'Siigo no está habilitado (SIIGO_ENABLED=false)',
    };
    await order.save();
    return order;
  }

  if (order.siigoFactura?.estado === 'emitida' && order.siigoFactura?.id) {
    return order;
  }

  try {
    const invoice = await crearFacturaSiigo(order);
    const mapped = mapSiigoInvoiceResult(invoice);
    order.siigoFactura = {
      estado: 'emitida',
      id: mapped.id,
      name: mapped.name,
      number: mapped.number,
      publicUrl: mapped.publicUrl,
      error: '',
      fechaEmision: new Date(),
    };
  } catch (error) {
    console.error('Error al facturar en Siigo:', error.message);
    order.siigoFactura = {
      estado: 'error',
      error: error.message,
    };
  }

  await order.save();
  return order;
}

module.exports = {
  emitirFacturaSiigo,
};
