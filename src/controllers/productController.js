const mongoose = require('mongoose');
const Product = require('../models/Product');
const {
  applyStockFromTallas,
  getAvailableStock,
  decrementProductStock,
  incrementProductStock,
} = require('../utils/productStock');

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
      const { 
        nombre, 
        descripcion, 
        descripcionCorta,
        precio, 
        genero, 
        categoria, 
        etiqueta, 
        stock, 
        imagen,
        imagenes,
        tallas,
        stockPorTalla,
        activo
      } = req.body;

      const productData = applyStockFromTallas({
        nombre,
        descripcion,
        descripcionCorta,
        precio,
        genero,
        categoria,
        etiqueta,
        stock,
        imagen,
        imagenes,
        tallas,
        stockPorTalla,
        activo
      });
      
      const product = new Product(productData);
      const newProduct = await product.save();
      res.status(201).json(newProduct);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // Update product
  updateProduct: async (req, res) => {
    try {
      const { 
        nombre, 
        descripcion, 
        descripcionCorta,
        precio, 
        genero, 
        categoria, 
        etiqueta, 
        stock, 
        imagen,
        imagenes,
        tallas,
        stockPorTalla,
        activo
      } = req.body;
      
      const product = await Product.findById(req.params.id);
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      const updateData = applyStockFromTallas({
        nombre: nombre !== undefined ? nombre : product.nombre,
        descripcion: descripcion !== undefined ? descripcion : product.descripcion,
        descripcionCorta: descripcionCorta !== undefined ? descripcionCorta : product.descripcionCorta,
        precio: precio !== undefined ? precio : product.precio,
        genero: genero !== undefined ? genero : product.genero,
        categoria: categoria !== undefined ? categoria : product.categoria,
        etiqueta: etiqueta !== undefined ? etiqueta : product.etiqueta,
        stock: stock !== undefined ? stock : product.stock,
        imagen: imagen !== undefined ? imagen : product.imagen,
        imagenes: imagenes !== undefined ? imagenes : product.imagenes,
        tallas: tallas !== undefined ? tallas : product.tallas,
        stockPorTalla: stockPorTalla !== undefined ? stockPorTalla : product.stockPorTalla,
        activo: activo !== undefined ? activo : product.activo,
      });

      Object.assign(product, updateData);

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