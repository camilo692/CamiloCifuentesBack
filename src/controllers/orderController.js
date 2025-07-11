const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');

const orderController = {
  // Crear nueva orden
  createOrder: async (req, res) => {
    try {
      const { 
        cliente, 
        direccion, 
        metodoPago, 
        notas = '',
        envio = 0,
        productos = []
      } = req.body;
      
      // Validar que hay productos
      if (!productos || productos.length === 0) {
        return res.status(400).json({ message: 'La orden debe tener al menos un producto' });
      }
      
      // Obtener información completa de productos y calcular totales
      const productosCompletos = [];
      let subtotal = 0;
      
      for (const item of productos) {
        const product = await Product.findById(item.productId);
        if (!product || !product.activo) {
          return res.status(400).json({ 
            message: `Producto ${product ? product.nombre : item.productId} no disponible` 
          });
        }
        
        if (product.stock < item.cantidad) {
          return res.status(400).json({ 
            message: `Stock insuficiente para ${product.nombre}. Disponible: ${product.stock}` 
          });
        }
        
        // Verificar que la talla esté disponible
        if (!product.tallas.includes(item.talla)) {
          return res.status(400).json({ 
            message: `Talla ${item.talla} no disponible para ${product.nombre}. Tallas disponibles: ${product.tallas.join(', ')}` 
          });
        }
        
        const itemSubtotal = product.precio * item.cantidad;
        subtotal += itemSubtotal;
        
        productosCompletos.push({
          producto: item.productId,
          nombre: product.nombre,
          precio: product.precio,
          cantidad: item.cantidad,
          talla: item.talla
        });
      }
      
      const total = subtotal + envio;
      
      // Crear la orden
      const order = new Order({
        cliente,
        direccion,
        productos: productosCompletos,
        subtotal,
        envio,
        total,
        metodoPago,
        notas
      });
      
      const savedOrder = await order.save();
      
      // Actualizar stock de productos
      for (const item of productos) {
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: -item.cantidad } }
        );
      }
      
      res.status(201).json({
        message: 'Orden creada exitosamente',
        order: savedOrder
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Obtener todas las órdenes
  getAllOrders: async (req, res) => {
    try {
      const orders = await Order.find()
        .populate('productos.producto', 'nombre precio imagen')
        .sort({ fechaCreacion: -1 });
      
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Obtener orden por ID
  getOrderById: async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'ID de orden inválido' });
      }
      
      const order = await Order.findById(req.params.id)
        .populate('productos.producto', 'nombre precio imagen descripcion');
      
      if (!order) {
        return res.status(404).json({ message: 'Orden no encontrada' });
      }
      
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Obtener órdenes por email del cliente
  getOrdersByEmail: async (req, res) => {
    try {
      const { email } = req.params;
      
      const orders = await Order.find({ 'cliente.email': email })
        .populate('productos.producto', 'nombre precio imagen')
        .sort({ fechaCreacion: -1 });
      
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Actualizar estado de la orden
  updateOrderStatus: async (req, res) => {
    try {
      const { estado } = req.body;
      
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'ID de orden inválido' });
      }
      
      const order = await Order.findById(req.params.id);
      if (!order) {
        return res.status(404).json({ message: 'Orden no encontrada' });
      }
      
      // Validar estado
      const estadosValidos = ['pendiente', 'confirmada', 'enviada', 'entregada', 'cancelada'];
      if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ 
          message: `Estado inválido. Estados válidos: ${estadosValidos.join(', ')}` 
        });
      }
      
      order.estado = estado;
      const updatedOrder = await order.save();
      
      res.json({
        message: 'Estado de orden actualizado',
        order: updatedOrder
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Actualizar orden completa
  updateOrder: async (req, res) => {
    try {
      const { 
        cliente, 
        direccion, 
        metodoPago, 
        notas,
        envio,
        productos 
      } = req.body;
      
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'ID de orden inválido' });
      }
      
      const order = await Order.findById(req.params.id);
      if (!order) {
        return res.status(404).json({ message: 'Orden no encontrada' });
      }
      
      // Solo permitir actualizar órdenes pendientes
      if (order.estado !== 'pendiente') {
        return res.status(400).json({ 
          message: 'Solo se pueden actualizar órdenes pendientes' 
        });
      }
      
      // Actualizar campos si se proporcionan
      if (cliente) order.cliente = cliente;
      if (direccion) order.direccion = direccion;
      if (metodoPago) order.metodoPago = metodoPago;
      if (notas !== undefined) order.notas = notas;
      if (envio !== undefined) order.envio = envio;
      
      // Si se actualizan productos, recalcular totales
      if (productos && productos.length > 0) {
        const productosCompletos = [];
        let subtotal = 0;
        
        for (const item of productos) {
          const product = await Product.findById(item.productId);
          if (!product || !product.activo) {
            return res.status(400).json({ 
              message: `Producto ${product ? product.nombre : item.productId} no disponible` 
            });
          }
          
          if (product.stock < item.cantidad) {
            return res.status(400).json({ 
              message: `Stock insuficiente para ${product.nombre}. Disponible: ${product.stock}` 
            });
          }
          
          const itemSubtotal = product.precio * item.cantidad;
          subtotal += itemSubtotal;
          
          productosCompletos.push({
            producto: item.productId,
            nombre: product.nombre,
            precio: product.precio,
            cantidad: item.cantidad,
            talla: item.talla
          });
        }
        
        order.productos = productosCompletos;
        order.subtotal = subtotal;
        order.total = subtotal + (order.envio || 0);
      }
      
      const updatedOrder = await order.save();
      
      res.json({
        message: 'Orden actualizada exitosamente',
        order: updatedOrder
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Eliminar orden
  deleteOrder: async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'ID de orden inválido' });
      }
      
      const order = await Order.findById(req.params.id);
      if (!order) {
        return res.status(404).json({ message: 'Orden no encontrada' });
      }
      
      // Solo permitir eliminar órdenes pendientes
      if (order.estado !== 'pendiente') {
        return res.status(400).json({ 
          message: 'Solo se pueden eliminar órdenes pendientes' 
        });
      }
      
      // Restaurar stock de productos
      for (const item of order.productos) {
        await Product.findByIdAndUpdate(
          item.producto,
          { $inc: { stock: item.cantidad } }
        );
      }
      
      await order.deleteOne();
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = orderController; 