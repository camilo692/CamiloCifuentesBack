const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  nombre: {
    type: String,
    // required: [true, 'El nombre del producto es requerido'],
    trim: true
  },
  descripcion: {
    type: String,
    // required: [true, 'La descripción del producto es requerida']
  },
  precio: {
    type: String,
    // required: [true, 'El precio del producto es requerido']
  },
  genero: {
    type: String,
    // required: [true, 'El género es requerido'],
    enum: ['masculino', 'femenino', 'unisex'],
    default: 'unisex'
  },
  categoria: {
    type: String,
    // required: [true, 'La categoría es requerida']
  },
  etiqueta: {
    type: String,
    default: ''
  },
  stock: {
    type: Number,
    required: [true, 'El stock es requerido'],
    min: [0, 'El stock no puede ser negativo'],
    default: 0
  },
  imagen: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Product', productSchema); 