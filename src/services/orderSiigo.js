const { isSiigoEnabled } = require('../config/siigo');
const {
  crearFacturaSiigo,
  enviarCorreoFacturaSiigo,
  mapSiigoInvoiceResult,
} = require('./siigoInvoiceService');

async function enviarCorreoSiigoOrden(order) {
  const invoiceId = order.siigoFactura?.id;
  if (!invoiceId) {
    throw new Error('La orden no tiene factura Siigo para enviar');
  }

  try {
    await enviarCorreoFacturaSiigo(invoiceId, order);
    order.siigoFactura.mailEnviado = true;
    order.siigoFactura.mailError = '';
  } catch (error) {
    console.error('Error al enviar factura Siigo por correo:', error.message);
    order.siigoFactura.mailEnviado = false;
    order.siigoFactura.mailError = error.message;
    throw error;
  }
}

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
    try {
      await enviarCorreoSiigoOrden(order);
    } catch {
      // El estado de correo queda en la orden.
    }
    await order.save();
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
      mailEnviado: false,
      mailError: '',
    };
    try {
      await enviarCorreoSiigoOrden(order);
    } catch {
      // La factura ya existe; el correo se puede reintentar.
    }
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
