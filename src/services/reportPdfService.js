const PDFDocument = require('pdfkit');
const sharp = require('sharp');
const Product = require('../models/Product');
require('../models/Category');
const Order = require('../models/Order');
const { TALLAS_ESTANDAR } = require('../utils/productStock');

const IVA_RATE = 0.19;

function money(value) {
  return `$${Number(value || 0).toLocaleString('es-CO')}`;
}

function moneyMasIva(value) {
  return `${money(value)} + IVA`;
}

function drawAmountRows(doc, rows) {
  rows.forEach((row) => {
    ensureSpace(doc, 16);
    const y = doc.y + 2;
    doc.font(row.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(row.bold ? 10 : 9)
      .fillColor('#111111');
    doc.text(row.label, 48, y, { width: 300 });
    doc.text(row.value, 348, y, { width: 207, align: 'right' });
    doc.y = y + 14;
  });
  doc.fillColor('#000000');
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

async function thumbnail(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length < 40) return null;
    return sharp(raw)
      .rotate()
      .resize(160, 160, { fit: 'cover', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
  } catch {
    return null;
  }
}

async function loadThumbnails(products) {
  const thumbs = new Map();
  const queue = products.filter((product) => product.imagen);
  const workers = 6;
  let index = 0;

  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (index < queue.length) {
        const product = queue[index];
        index += 1;
        const image = await thumbnail(product.imagen);
        if (image) thumbs.set(String(product._id), image);
      }
    })
  );

  return thumbs;
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

function renderPdf(filename, draw) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: filename } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve({ filename, buffer: Buffer.concat(chunks) }));
    doc.on('error', reject);

    Promise.resolve()
      .then(() => draw(doc))
      .then(() => doc.end())
      .catch(reject);
  });
}

function sendPdf(res, filename, buffer) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
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

  const thumbs = await loadThumbnails(filtered);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `inventario-camilo-${stamp}.pdf`;

  const { buffer } = await renderPdf(filename, (doc) => {
    drawHeader(
      doc,
      'Inventario',
      `Generado ${formatDate(new Date())}  ·  ${filtered.length} prendas`
    );

    if (filtered.length === 0) {
      doc.fontSize(12).text('No hay productos para este filtro.');
      return;
    }

    for (const product of filtered) {
      ensureSpace(doc, 130);
      const top = doc.y;
      const imageBuf = thumbs.get(String(product._id));
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
        `${product.categoria?.name || 'Sin categoría'}  ·  ${moneyMasIva(product.precio)}  ·  Stock total: ${product.stock ?? 0}`,
        textX,
        doc.y + 2,
        { width: 390 }
      );
      doc.fillColor('#000000');

      const rows = sizeRows(product);
      const tableY = Math.max(doc.y + 10, top + 52);
      const colW = Math.min(46, 390 / Math.max(rows.length, 1));
      rows.forEach((row, rowIndex) => {
        const x = textX + rowIndex * colW;
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

    const valor = filtered.reduce(
      (sum, product) => sum + Number(product.precio || 0) * Number(product.stock || 0),
      0
    );
    const iva = Math.round(valor * IVA_RATE);
    ensureSpace(doc, 70);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#cccccc');
    doc.y += 8;
    drawAmountRows(doc, [
      { label: 'Valor inventario', value: money(valor) },
      { label: 'IVA 19%', value: money(iva) },
      { label: 'Total inventario', value: money(valor + iva), bold: true },
    ]);
  });

  sendPdf(res, filename, buffer);
}

async function streamOrdersPdf(res, { estado } = {}) {
  const filter = {};
  const wanted = String(estado || 'todos').toLowerCase();
  if (wanted && wanted !== 'todos') {
    filter.estado = wanted;
  }

  const orders = await Order.find(filter).sort({ fechaCreacion: -1 }).lean();
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `pedidos-camilo-${stamp}.pdf`;

  const { buffer } = await renderPdf(filename, (doc) => {
    drawHeader(
      doc,
      'Pedidos',
      `Generado ${formatDate(new Date())}  ·  ${orders.length} órdenes`
    );

    if (orders.length === 0) {
      doc.fontSize(12).text('No hay pedidos para este filtro.');
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
        const lineTotal = (item.precio || 0) * (item.cantidad || 0);
        doc.font('Helvetica').fontSize(9).fillColor('#111111').text(
          `${item.cantidad || 0} × ${item.nombre || 'Prenda'}${talla}  —  ${moneyMasIva(lineTotal)}`,
          48,
          doc.y + 2,
          { width: 500 }
        );
      });

      const subtotal = Number(order.subtotal || 0);
      const iva = Number(order.iva || 0);
      const envio = Number(order.envio || 0);
      ensureSpace(doc, 72);
      doc.y += 6;
      drawAmountRows(doc, [
        { label: 'Subtotal', value: money(subtotal) },
        { label: 'IVA 19%', value: money(iva) },
        { label: 'Envío', value: money(envio) },
        { label: 'Total', value: money(order.total), bold: true },
      ]);
      doc.fillColor('#000000');

      doc.moveTo(40, doc.y + 8).lineTo(555, doc.y + 8).stroke('#eeeeee');
      doc.y += 18;
    }
  });

  sendPdf(res, filename, buffer);
}

module.exports = {
  streamInventoryPdf,
  streamOrdersPdf,
};
