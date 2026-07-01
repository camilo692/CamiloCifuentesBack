const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  cliente: {
    nombre: {
      type: String,
      required: [true, 'El nombre del cliente es requerido']
    },
    apellidos: {
      type: String,
      default: ''
    },
    email: {
      type: String,
      required: [true, 'El email del cliente es requerido']
    },
    telefono: {
      type: String,
      required: [true, 'El teléfono del cliente es requerido']
    },
    cedula: {
      type: String,
      default: ''
    }
  },
  direccion: {
    calle: {
      type: String,
      required: [true, 'La calle es requerida']
    },
    complemento: {
      type: String,
      default: ''
    },
    ciudad: {
      type: String,
      required: [true, 'La ciudad es requerida']
    },
    departamento: {
      type: String,
      default: ''
    },
    codigoPostal: {
      type: String,
      default: ''
    },
    pais: {
      type: String,
      required: [true, 'El país es requerido'],
      default: 'Colombia'
    }
  },
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
      default: 'Única'
    }
  }],
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
  estado: {
    type: String,
    enum: ['pendiente', 'confirmada', 'enviada', 'entregada', 'cancelada'],
    default: 'pendiente'
  },
  metodoPago: {
    type: String,
    enum: ['efectivo', 'tarjeta', 'transferencia', 'mercadopago', 'paypal'],
    required: [true, 'El método de pago es requerido']
  },
  notas: {
    type: String,
    default: ''
  },
  notasInternas: {
    type: String,
    default: ''
  },
  numeroGuia: {
    type: String,
    default: ''
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

module.exports = mongoose.model('Order', orderSchema);
