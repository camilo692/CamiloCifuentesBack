const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre del producto es requerido'],
    trim: true
  },
  descripcion: {
    type: String,
    default: ''
  },
  descripcionCorta: {
    type: String,
    default: ''
  },
  precio: {
    type: Number,
    required: [true, 'El precio del producto es requerido'],
    min: [0, 'El precio no puede ser negativo']
  },
  genero: {
    type: String,
    required: [true, 'El género es requerido'],
    enum: ['unisex', 'hombre', 'mujer'],
    default: 'unisex'
  },
  categoria: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'La categoría es requerida']
  },
  imagen: {
    type: String,
    default: ''
  },
  imagenes: [{
    type: String
  }],
  tallas: [{
    type: String
  }],
  stockPorTalla: [{
    talla: {
      type: String,
      required: true,
      trim: true
    },
    cantidad: {
      type: Number,
      default: 0,
      min: [0, 'El stock por talla no puede ser negativo']
    }
  }],
  stock: {
    type: Number,
    required: [true, 'El stock es requerido'],
    min: [0, 'El stock no puede ser negativo'],
    default: 0
  },
  etiqueta: {
    type: String,
    default: ''
  },
  activo: {
    type: Boolean,
    default: true
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  },
  fechaActualizacion: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'fechaCreacion', updatedAt: 'fechaActualizacion' }
});

module.exports = mongoose.model('Product', productSchema); 