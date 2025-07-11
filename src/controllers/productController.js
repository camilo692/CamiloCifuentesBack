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
        activo
      } = req.body;
      
      const product = new Product({
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
        activo
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
        activo
      } = req.body;
      
      const product = await Product.findById(req.params.id);
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      if (nombre !== undefined) product.nombre = nombre;
      if (descripcion !== undefined) product.descripcion = descripcion;
      if (descripcionCorta !== undefined) product.descripcionCorta = descripcionCorta;
      if (precio !== undefined) product.precio = precio;
      if (genero !== undefined) product.genero = genero;
      if (categoria !== undefined) product.categoria = categoria;
      if (etiqueta !== undefined) product.etiqueta = etiqueta;
      if (stock !== undefined) product.stock = stock;
      if (imagen !== undefined) product.imagen = imagen;
      if (imagenes !== undefined) product.imagenes = imagenes;
      if (tallas !== undefined) product.tallas = tallas;
      if (activo !== undefined) product.activo = activo;

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