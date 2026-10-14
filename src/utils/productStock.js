const TALLAS_ESTANDAR = ['S', 'M', 'L', 'XL', 'XXL'];

function normalizeStockPorTalla(stockPorTalla = []) {
  if (!Array.isArray(stockPorTalla)) return [];

  return stockPorTalla
    .map((entry) => ({
      talla: String(entry.talla || '').trim(),
      cantidad: Math.max(0, Number(entry.cantidad) || 0),
    }))
    .filter((entry) => entry.talla);
}

function applyStockFromTallas(data) {
  const stockPorTalla = normalizeStockPorTalla(data.stockPorTalla);

  if (stockPorTalla.length > 0) {
    data.stockPorTalla = stockPorTalla;
    data.tallas = stockPorTalla.map((entry) => entry.talla);
    data.stock = stockPorTalla.reduce((sum, entry) => sum + entry.cantidad, 0);
    return data;
  }

  if (Array.isArray(data.tallas) && data.tallas.length > 0) {
    data.stockPorTalla = [];
    data.tallas = data.tallas.map((t) => String(t).trim()).filter(Boolean);
    data.stock = Math.max(0, Number(data.stock) || 0);
    return data;
  }

  data.stockPorTalla = [];
  data.tallas = [];
  data.stock = Math.max(0, Number(data.stock) || 0);
  return data;
}

function getAvailableStock(product, talla) {
  if (product.stockPorTalla?.length) {
    if (!talla) {
      return product.stockPorTalla.reduce((sum, entry) => sum + entry.cantidad, 0);
    }

    const entry = product.stockPorTalla.find((item) => item.talla === talla);
    return entry ? entry.cantidad : 0;
  }

  return product.stock;
}

async function decrementProductStock(Product, productId, cantidad, talla) {
  const qty = Number(cantidad);
  if (!productId || !Number.isFinite(qty) || qty <= 0) return null;

  const product = await Product.findById(productId).lean();
  if (!product) return null;

  if (product.stockPorTalla?.length && talla) {
    return Product.findOneAndUpdate(
      {
        _id: productId,
        stockPorTalla: {
          $elemMatch: {
            talla,
            cantidad: { $gte: qty },
          },
        },
      },
      {
        $inc: {
          'stockPorTalla.$.cantidad': -qty,
          stock: -qty,
        },
      },
      { new: true }
    );
  }

  return Product.findOneAndUpdate(
    {
      _id: productId,
      stock: { $gte: qty },
    },
    { $inc: { stock: -qty } },
    { new: true }
  );
}

async function incrementProductStock(Product, productId, cantidad, talla) {
  const qty = Number(cantidad);
  if (!productId || !Number.isFinite(qty) || qty <= 0) return null;

  if (talla) {
    const updated = await Product.findOneAndUpdate(
      {
        _id: productId,
        'stockPorTalla.talla': talla,
      },
      {
        $inc: {
          'stockPorTalla.$.cantidad': qty,
          stock: qty,
        },
      },
      { new: true }
    );

    if (updated) return updated;

    const product = await Product.findById(productId).lean();
    if (product?.stockPorTalla?.length) {
      return Product.findOneAndUpdate(
        { _id: productId },
        {
          $push: { stockPorTalla: { talla, cantidad: qty } },
          $inc: { stock: qty },
        },
        { new: true }
      );
    }
  }

  return Product.findOneAndUpdate(
    { _id: productId },
    { $inc: { stock: qty } },
    { new: true }
  );
}

module.exports = {
  TALLAS_ESTANDAR,
  normalizeStockPorTalla,
  applyStockFromTallas,
  getAvailableStock,
  decrementProductStock,
  incrementProductStock,
};
