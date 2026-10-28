const { SESv2Client, SendEmailCommand } = require('@aws-sdk/client-sesv2');
const { isOrderEmailEnabled, getOrderEmailConfig } = require('../config/orderEmail');

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => {
    return ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char];
  });
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString('es-CO')}`;
}

function orderReference(order) {
  return String(order._id).slice(-8).toUpperCase();
}

function buildBodies(order, storeUrl) {
  const nombre = [order.cliente?.nombre, order.cliente?.apellidos].filter(Boolean).join(' ').trim();
  const referencia = orderReference(order);
  const lineas = (order.productos || []).map((item) => {
    const talla = item.talla ? ` · talla ${item.talla}` : '';
    return `${item.cantidad} × ${item.nombre}${talla} — ${formatMoney(item.precio * item.cantidad)}`;
  });
  const consulta = `${storeUrl}/tienda/pedido`;

  const text = [
    `Hola${nombre ? ` ${nombre}` : ''},`,
    '',
    'Confirmamos tu pedido en Camilo Cifuentes. El pago ya fue aprobado.',
    '',
    `Número de orden: ${referencia}`,
    ...lineas,
    `Envío: gratis`,
    `Total: ${formatMoney(order.total)}`,
    '',
    `Consulta el pedido con este correo y el número de orden: ${consulta}`,
    '',
    'El despacho se gestiona después de este cobro.',
    '',
    'Camilo Cifuentes',
  ].join('\n');

  const filas = (order.productos || [])
    .map((item) => {
      const talla = item.talla ? ` talla ${escapeHtml(item.talla)}` : '';
      return `<tr><td style="padding:6px 0">${escapeHtml(String(item.cantidad))} × ${escapeHtml(item.nombre)}${talla}</td><td style="padding:6px 0;text-align:right">${formatMoney(item.precio * item.cantidad)}</td></tr>`;
    })
    .join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;color:#111">
      <p>Hola${nombre ? ` ${escapeHtml(nombre)}` : ''},</p>
      <p>Confirmamos tu pedido en <strong>Camilo Cifuentes</strong>. El pago ya fue aprobado.</p>
      <p>Número de orden: <strong>${escapeHtml(referencia)}</strong></p>
      <table style="width:100%;border-collapse:collapse">${filas}</table>
      <p>Envío: <strong>gratis</strong><br/>Total: <strong>${formatMoney(order.total)}</strong></p>
      <p>Consulta el pedido con este correo y el número de orden:<br/><a href="${escapeHtml(consulta)}">${escapeHtml(consulta)}</a></p>
      <p>El despacho se gestiona después de este cobro.</p>
      <p>Camilo Cifuentes</p>
    </div>
  `;

  return {
    subject: `Pedido ${referencia} confirmado — Camilo Cifuentes`,
    text,
    html,
  };
}

async function sendOrderPaidEmail(order) {
  if (!isOrderEmailEnabled()) {
    return { skipped: true, reason: 'desactivado' };
  }

  const to = String(order.cliente?.email || '').trim().toLowerCase();
  if (!to) {
    return { skipped: true, reason: 'sin correo' };
  }

  if (order.correoConfirmacion?.estado === 'enviado') {
    return { skipped: true, reason: 'ya enviado' };
  }

  try {
    const config = getOrderEmailConfig();
    const bodies = buildBodies(order, config.storeUrl);
    const client = new SESv2Client({ region: config.region });
    const input = {
      FromEmailAddress: config.from,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: bodies.subject, Charset: 'UTF-8' },
          Body: {
            Text: { Data: bodies.text, Charset: 'UTF-8' },
            Html: { Data: bodies.html, Charset: 'UTF-8' },
          },
        },
      },
    };
    if (config.replyTo) {
      input.ReplyToAddresses = [config.replyTo];
    }

    await client.send(new SendEmailCommand(input));

    order.correoConfirmacion = {
      estado: 'enviado',
      enviadoEn: new Date(),
      error: '',
    };
    await order.save();
    return { ok: true };
  } catch (error) {
    console.error('Correo de pedido:', error.message);
    order.correoConfirmacion = {
      estado: 'error',
      enviadoEn: null,
      error: String(error.message || 'error').slice(0, 400),
    };
    try {
      await order.save();
    } catch (saveError) {
      console.error('Correo de pedido (save):', saveError.message);
    }
    return { ok: false, error: error.message };
  }
}

module.exports = {
  sendOrderPaidEmail,
  orderReference,
};
