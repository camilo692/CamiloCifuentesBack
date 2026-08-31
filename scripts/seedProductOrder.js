require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
const mongoose = require('mongoose');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');

/**
 * Asigna orden 1..N a cada producto según el orden actual dentro de su categoría.
 * Útil la primera vez o para re-sincronizar.
 */
const seedProductOrder = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const categories = await Category.find();

    for (const cat of categories) {
      const products = await Product.find({ categoria: cat._id }).sort({
        orden: 1,
        fechaCreacion: -1,
      });

      for (let i = 0; i < products.length; i++) {
        products[i].orden = i + 1;
        await products[i].save();
        console.log(`${cat.name} #${i + 1}: ${products[i].nombre}`);
      }
    }

    console.log('Orden de productos actualizado.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

seedProductOrder();
