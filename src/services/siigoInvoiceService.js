const { getSiigoConfig } = require('../config/siigo');
const { getSiigoAccessToken, clearSiigoToken } = require('./siigoAuth');
const { getSiigoCityCodes } = require('../utils/siigoCities');

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function onlyDigits(value = '') {
  return String(value).replace(/\D/g, '');
}

function sanitizeName(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function buildCustomer(order) {
  const firstName = sanitizeName(order.cliente?.nombre) || 'Cliente';
  const lastName = sanitizeName(order.cliente?.apellidos) || 'Web';
  const identification = onlyDigits(order.cliente?.cedula);

  if (!identification) {
    throw new Error('La cédula del cliente es requerida para facturar en Siigo');
  }

  const city = getSiigoCityCodes(order.direccion?.ciudad, order.direccion?.departamento);
  const phone = onlyDigits(order.cliente?.telefono).slice(-10);
  const email = String(order.cliente?.email || '').trim();
  const postalCode = onlyDigits(order.direccion?.codigoPostal);

  const customer = {
    person_type: 'Person',
    id_type: '13',
    identification,
    branch_office: 0,
    name: [firstName, lastName],
    address: {
      address: String(order.direccion?.calle || 'Colombia').slice(0, 256),
      city,
    },
    contacts: [
      {
        first_name: firstName,
        last_name: lastName,
        ...(email ? { email } : {}),
      },
    ],
  };

  if (postalCode) {
    customer.address.postal_code = postalCode;
  }

  if (phone) {
    customer.phones = [{ indicative: '57', number: phone }];
  }

  return customer;
}

function buildItems(order, config) {
  const taxes =
    config.taxId && Number(order.iva || 0) > 0 ? [{ id: config.taxId }] : undefined;

  const items = (order.productos || []).map((item) => {
    const line = {
      code: config.productCode,
      description: `${item.nombre}${item.talla ? ` Talla ${item.talla}` : ''}`.slice(0, 100),
      quantity: Number(item.cantidad),
      price: roundMoney(item.precio),
    };

    if (taxes) {
      line.taxes = taxes;
    }
    return line;
  });

  if (Number(order.envio) > 0 && config.shippingCode) {
    const shipping = {
      code: config.shippingCode,
      description: 'Costo de envio',
      quantity: 1,
      price: roundMoney(order.envio),
    };
    // El envío se cobra aparte, sin IVA extra.
    items.push(shipping);
  }

  return items;
}

function buildInvoicePayload(order, config, options = {}) {
  const items = buildItems(order, config);
  const total = roundMoney(order.total);
  const stamp = options.stamp ?? config.stamp;
  const sendMail = options.sendMail ?? config.sendMail;

  const payload = {
    document: { id: config.documentId },
    date: todayIsoDate(),
    customer: buildCustomer(order),
    seller: config.sellerId,
    observations: `Pedido web ${order._id}`.slice(0, 4000),
    items,
    payments: [
      {
        id: config.paymentTypeId,
        value: total,
      },
    ],
  };

  if (stamp) {
    payload.stamp = { send: true };
  }
  if (sendMail) {
    payload.mail = { send: true };
  }

  return payload;
}

async function enviarCorreoFacturaSiigo(invoiceId, order) {
  const email = String(order?.cliente?.email || '').trim();
  if (!invoiceId || !email) {
    throw new Error('Falta el correo del cliente o el id de la factura Siigo');
  }

  const config = getSiigoConfig();
  const body = {
    guid: invoiceId,
    mail_to: email,
  };

  const copy = String(config.username || '').trim();
  if (copy && copy.includes('@') && copy.toLowerCase() !== email.toLowerCase()) {
    body.copy_to = copy;
  }

  return siigoRequest(`/v1/invoices/${invoiceId}/mail`, {
    method: 'POST',
    body,
  });
}

function isSendSettingsError(error) {
  const message = String(error?.message || '');
  return error?.status === 400 && /send cannot be used/i.test(message);
}

async function siigoRequest(path, { method = 'GET', body } = {}) {
  const config = getSiigoConfig();
  const token = await getSiigoAccessToken();

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'Partner-Id': config.partnerId,
  };

  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    clearSiigoToken();
  }

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message =
      data?.Errors?.[0]?.Message ||
      data?.errors?.[0]?.message ||
      data?.message ||
      text ||
      `HTTP ${response.status}`;
    const error = new Error(`Error Siigo (${response.status}): ${message}`);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

async function crearFacturaSiigo(order) {
  const config = getSiigoConfig();
  const attempts = [
    { stamp: config.stamp, sendMail: false },
    { stamp: false, sendMail: false },
  ];

  const seen = new Set();
  let lastError;

  for (const options of attempts) {
    const key = `${options.stamp}:${options.sendMail}`;
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      return await siigoRequest('/v1/invoices', {
        method: 'POST',
        body: buildInvoicePayload(order, config, options),
      });
    } catch (error) {
      lastError = error;
      if (!isSendSettingsError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

function mapSiigoInvoiceResult(invoice) {
  return {
    id: invoice.id || invoice._id || '',
    name: invoice.name || '',
    number: invoice.number || null,
    date: invoice.date || '',
    publicUrl: invoice.public_url || invoice.pdf || '',
    stamped: Boolean(invoice.stamp?.status || invoice.stamp?.send),
    rawStatus: invoice.stamp || null,
  };
}

module.exports = {
  crearFacturaSiigo,
  enviarCorreoFacturaSiigo,
  mapSiigoInvoiceResult,
  buildInvoicePayload,
};
