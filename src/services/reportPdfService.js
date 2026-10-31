const PDFDocument = require('pdfkit');
const Product = require('../models/Product');
require('../models/Category');
const Order = require('../models/Order');
const { TALLAS_ESTANDAR } = require('../utils/productStock');

function money(value) {
  return `$${Number(value || 0).toLocaleString('es-CO')}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function orderRef(order) {
  return String(order._id).slice(-8).toUpperCase();
}

function ensureSpace(doc, needed = 80) {
  if (doc.y + needed > doc.page.height - 50) {
    doc.addPage();
  }
}

function drawHeader(doc, title, subtitle) {
  doc.rect(0, 0, doc.page.width, 52).fill('#000000');
  doc.fillColor('#ffc600').fontSize(16).font('Helvetica-Bold').text('Camilo Cifuentes', 40, 14, {
    width: 300,
  });
  doc.fillColor('#ffffff').fontSize(11).font('Helvetica').text(title, 40, 32, { width: 360 });
  doc.fillColor('#cccccc').fontSize(8).text(subtitle, 0, 20, {
    width: doc.page.width - 40,
    align: 'right',
  });
  doc.fillColor('#000000');
  doc.y = 70;
}

async function fetchImage(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('jpeg') && !contentType.includes('jpg') && !contentType.includes('png')) {
      return null;
    }
    const buf = Buffer.from(await response.arrayBuffer());
    return buf.length > 40 ? buf : null;
  } catch {
    return null;
  }
}

function sizeRows(product) {
  if (product.stockPorTalla?.length) {
    return product.stockPorTalla.map((row) => ({
      talla: row.talla,
      cantidad: Number(row.cantidad || 0),
    }));
  }
  if (product.tallas?.length) {
    return product.tallas.map((talla) => ({ talla, cantidad: Number(product.stock || 0) }));
  }
  return TALLAS_ESTANDAR.map((talla) => ({ talla, cantidad: 0 }));
}

function pipePdf(res, filename) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: filename } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);
  return doc;
}

async function streamInventoryPdf(res, { filtro } = {}) {
  const products = await Product.find()
    .populate('categoria', 'name')
    .sort({ orden: 1, fechaCreacion: -1 })
    .lean();

  const wanted = String(filtro || '').toLowerCase();
  const filtered = products.filter((product) => {
    if (product.activo === false) return false;
    const cat = String(product.categoria?.name || '').toLowerCase();
    if (wanted === 'busos') return cat.includes('buso') || cat.includes('buzo');
    if (wanted === 'camisas') return cat.includes('camisa');
    return true;
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const doc = pipePdf(res, `inventario-camilo-${stamp}.pdf`);
  drawHeader(
    doc,
    'Inventario',
    `Generado ${formatDate(new Date())}  ·  ${filtered.length} prendas`
  );

  if (filtered.length === 0) {
    doc.fontSize(12).text('No hay productos para este filtro.');
    doc.end();
    return;
  }

  for (const product of filtered) {
    ensureSpace(doc, 130);
    const top = doc.y;
    const imageBuf = await fetchImage(product.imagen);
    if (imageBuf) {
      try {
        doc.image(imageBuf, 40, top, { fit: [78, 78] });
      } catch {
        doc.rect(40, top, 78, 78).stroke('#dddddd');
      }
    } else {
      doc.rect(40, top, 78, 78).fillAndStroke('#f4f4f4', '#dddddd');
      doc.fillColor('#999999').fontSize(8).text('Sin foto', 40, top + 34, { width: 78, align: 'center' });
      doc.fillColor('#000000');
    }

    const textX = 132;
    doc.font('Helvetica-Bold').fontSize(12).text(product.nombre || 'Sin nombre', textX, top, {
      width: 390,
    });
    doc.font('Helvetica').fontSize(9).fillColor('#555555');
    doc.text(
      `${product.categoria?.name || 'Sin categoría'}  ·  ${money(product.precio)}  ·  Stock total: ${product.stock ?? 0}`,
      textX,
      doc.y + 2,
      { width: 390 }
    );
    doc.fillColor('#000000');

    const rows = sizeRows(product);
    let tableY = Math.max(doc.y + 10, top + 52);
    const colW = Math.min(46, 390 / Math.max(rows.length, 1));
    rows.forEach((row, index) => {
      const x = textX + index * colW;
      doc.rect(x, tableY, colW - 4, 28).stroke('#dddddd');
      doc.font('Helvetica-Bold').fontSize(8).text(row.talla, x, tableY + 3, {
        width: colW - 4,
        align: 'center',
      });
      doc.font('Helvetica').fontSize(10).text(String(row.cantidad), x, tableY + 14, {
        width: colW - 4,
        align: 'center',
      });
    });

    doc.y = Math.max(tableY + 40, top + 90);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#eeeeee');
    doc.y += 12;
  }

  doc.end();
}

async function streamOrdersPdf(res, { estado } = {}) {
  const filter = {};
  const wanted = String(estado || 'todos').toLowerCase();
  if (wanted && wanted !== 'todos') {
    filter.estado = wanted;
  }

  const orders = await Order.find(filter).sort({ fechaCreacion: -1 }).lean();
  const stamp = new Date().toISOString().slice(0, 10);
  const doc = pipePdf(res, `pedidos-camilo-${stamp}.pdf`);
  drawHeader(
    doc,
    'Pedidos',
    `Generado ${formatDate(new Date())}  ·  ${orders.length} órdenes`
  );

  if (orders.length === 0) {
    doc.fontSize(12).text('No hay pedidos para este filtro.');
    doc.end();
    return;
  }

  for (const order of orders) {
    ensureSpace(doc, 90);
    const nombre = [order.cliente?.nombre, order.cliente?.apellidos].filter(Boolean).join(' ') || 'Cliente';
    doc.font('Helvetica-Bold').fontSize(11).text(`Pedido ${orderRef(order)}`, 40, doc.y);
    doc.font('Helvetica').fontSize(9).fillColor('#444444');
    doc.text(
      `${formatDate(order.fechaCreacion)}  ·  ${nombre}  ·  ${order.cliente?.email || 'sin correo'}`,
      40,
      doc.y + 2,
      { width: 515 }
    );
    doc.text(
      `Estado: ${order.estado || '—'}  ·  Pago: ${order.pago?.estado || '—'}  ·  Total: ${money(order.total)}`,
      40,
      doc.y + 2,
      { width: 515 }
    );
    doc.fillColor('#000000');

    const items = order.productos || [];
    items.forEach((item) => {
      ensureSpace(doc, 16);
      const talla = item.talla ? ` · talla ${item.talla}` : '';
      doc.font('Helvetica').fontSize(9).fillColor('#111111').text(
        `${item.cantidad || 0} × ${item.nombre || 'Prenda'}${talla}  —  ${money((item.precio || 0) * (item.cantidad || 0))}`,
        48,
        doc.y + 2,
        { width: 500 }
      );
    });
    doc.fillColor('#000000');

    doc.moveTo(40, doc.y + 8).lineTo(555, doc.y + 8).stroke('#eeeeee');
    doc.y += 18;
  }

  doc.end();
}

module.exports = {
  streamInventoryPdf,
  streamOrdersPdf,
};
