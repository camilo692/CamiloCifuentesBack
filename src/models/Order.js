const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // Información del cliente
  cliente: {
    nombre: {
      type: String,
      required: [true, 'El nombre del cliente es requerido']
    },
    email: {
      type: String,
      required: [true, 'El email del cliente es requerido']
    },
    telefono: {
      type: String,
      required: [true, 'El teléfono del cliente es requerido']
    }
  },
  // Dirección de envío
  direccion: {
    calle: {
      type: String,
      required: [true, 'La calle es requerida']
    },
    ciudad: {
      type: String,
      required: [true, 'La ciudad es requerida']
    },
    codigoPostal: {
      type: String,
      required: [true, 'El código postal es requerido']
    },
    pais: {
      type: String,
      required: [true, 'El país es requerido'],
      default: 'Colombia'
    }
  },
  // Productos en la orden
  productos: [{
    producto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    nombre: {
      type: String,
      required: true
    },
    precio: {
      type: Number,
      required: true
    },
    cantidad: {
      type: Number,
      required: true,
      min: 1
    },
    talla: {
      type: String,
      required: true
    }
  }],
  // Totales
  subtotal: {
    type: Number,
    required: true
  },
  envio: {
    type: Number,
    required: true,
    default: 0
  },
  total: {
    type: Number,
    required: true
  },
  // Estado de la orden
  estado: {
    type: String,
    enum: ['pendiente', 'confirmada', 'enviada', 'entregada', 'cancelada'],
    default: 'pendiente'
  },
  // Método de pago
  metodoPago: {
    type: String,
    enum: ['efectivo', 'tarjeta', 'transferencia'],
    required: [true, 'El método de pago es requerido']
  },
  // Notas adicionales
  notas: {
    type: String,
    default: ''
  },
  // Fechas
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

module.exports = mongoose.model('Order', orderSchema); 