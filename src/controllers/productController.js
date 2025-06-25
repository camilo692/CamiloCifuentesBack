const mongoose = require('mongoose');
const Product = require('../models/Product');

const productController = {
  // Get all products
  getAllProducts: async (req, res) => {
    try {
      const products = await Product.find();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get products by category
  getProductsByCategory: async (req, res) => {
    try {
      console.log(req.params.categoryId,"categoryId");
      const products = await Product.find({ categoria: req.params.categoryId });
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },  

  // Get product by ID
  getProductById: async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }
    try {
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
  

  // Create new product
  createProduct: async (req, res) => {
    try {
      const { nombre, descripcion, precio, genero, categoria, etiqueta, stock, imagen } = req.body;
      const product = new Product({
        nombre,
        descripcion,
        precio,
        genero,
        categoria,
        etiqueta,
        stock,
        imagen
      });
      const newProduct = await product.save();
      res.status(201).json(newProduct);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // Update product
  updateProduct: async (req, res) => {
    try {
      const { nombre, descripcion, precio, genero, categoria, etiqueta, stock, imagen } = req.body;
      const product = await Product.findById(req.params.id);
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      if (nombre) product.nombre = nombre;
      if (descripcion) product.descripcion = descripcion;
      if (precio) product.precio = precio;
      if (genero) product.genero = genero;
      if (categoria) product.categoria = categoria;
      if (etiqueta) product.etiqueta = etiqueta;
      if (stock) product.stock = stock;
      if (imagen) product.imagen = imagen;

      const updatedProduct = await product.save();
      res.json(updatedProduct);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // Delete product
  deleteProduct: async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      await product.deleteOne();
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = productController; 