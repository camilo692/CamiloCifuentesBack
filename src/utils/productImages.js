const { signReadUrl } = require('../services/r2Service');

async function mapProductImages(product) {
  if (!product) return product;
  const obj = typeof product.toObject === 'function' ? product.toObject() : { ...product };
  obj.imagen = await signReadUrl(obj.imagen);
  if (Array.isArray(obj.imagenes)) {
    obj.imagenes = await Promise.all(obj.imagenes.map((url) => signReadUrl(url)));
  }
  return obj;
}

function mapProductsImages(products) {
  return Promise.all(products.map(mapProductImages));
}

module.exports = {
  mapProductImages,
  mapProductsImages,
};
