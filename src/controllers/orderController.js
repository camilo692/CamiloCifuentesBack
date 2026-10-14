const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const {
  getAvailableStock,
  decrementProductStock,
  incrementProductStock,
} = require('../utils/productStock');
const { isSiigoEnabled } = require('../config/siigo');
const {
  crearFacturaSiigo,
  mapSiigoInvoiceResult,
} = require('../services/siigoInvoiceService');

async function emitirFacturaSiigo(order) {
  if (!isSiigoEnabled()) {
    order.siigoFactura = {
      estado: 'omitida',
      error: 'Siigo no está habilitado (SIIGO_ENABLED=false)',
    };
    await order.save();
    return order;
  }

  if (order.siigoFactura?.estado === 'emitida' && order.siigoFactura?.id) {
    return order;
  }

  try {
    const invoice = await crearFacturaSiigo(order);
    const mapped = mapSiigoInvoiceResult(invoice);
    order.siigoFactura = {
      estado: 'emitida',
      id: mapped.id,
      name: mapped.name,
      number: mapped.number,
      publicUrl: mapped.publicUrl,
      error: '',
      fechaEmision: new Date(),
    };
  } catch (error) {
    console.error('Error al facturar en Siigo:', error.message);
    order.siigoFactura = {
      estado: 'error',
      error: error.message,
    };
  }

  await order.save();
  return order;
}

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
        
        const talla = item.talla || product.tallas?.[0] || 'Única';
        const availableStock = getAvailableStock(product, product.tallas?.length ? talla : null);

        if (availableStock < item.cantidad) {
          const tallaLabel = product.tallas?.length ? ` talla ${talla}` : '';
          return res.status(400).json({ 
            message: `Lo sentimos, "${product.nombre}"${tallaLabel} ya no tiene unidades suficientes (quedan ${availableStock}). No se realizó el pedido. Elige otra talla o producto.` 
          });
        }
        
        if (product.tallas?.length && item.talla && !product.tallas.includes(item.talla)) {
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
          talla
        });
      }
      
      const total = subtotal + envio;

      const reservas = [];
      for (const item of productosCompletos) {
        const updated = await decrementProductStock(
          Product,
          item.producto,
          item.cantidad,
          item.talla
        );

        if (!updated) {
          for (const reserva of reservas) {
            await incrementProductStock(
              Product,
              reserva.producto,
              reserva.cantidad,
              reserva.talla
            );
          }

          const tallaLabel = item.talla ? ` talla ${item.talla}` : '';
          return res.status(400).json({
            message: `Lo sentimos, "${item.nombre}"${tallaLabel} se agotó mientras completabas el pago. No se realizó el pedido. Vuelve al carrito y elige otra talla o producto.`,
          });
        }

        reservas.push({
          producto: item.producto,
          cantidad: item.cantidad,
          talla: item.talla,
        });
      }

      let savedOrder;
      try {
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
        savedOrder = await order.save();
      } catch (error) {
        for (const reserva of reservas) {
          await incrementProductStock(
            Product,
            reserva.producto,
            reserva.cantidad,
            reserva.talla
          );
        }
        throw error;
      }

      await emitirFacturaSiigo(savedOrder);
      
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
      const { estado, numeroGuia, notasInternas } = req.body;
      
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

      const estadoAnterior = order.estado;

      if (estado === 'cancelada' && estadoAnterior !== 'cancelada') {
        for (const item of order.productos) {
          const productId = item.producto?._id || item.producto;
          const restored = await incrementProductStock(
            Product,
            productId,
            item.cantidad,
            item.talla
          );

          if (!restored) {
            return res.status(400).json({
              message: `No se pudo restaurar el stock del producto ${item.nombre}`,
            });
          }
        }
      }
      
      order.estado = estado;
      if (numeroGuia !== undefined) order.numeroGuia = numeroGuia;
      if (notasInternas !== undefined) order.notasInternas = notasInternas;
      const updatedOrder = await order.save();
      
      res.json({
        message:
          estado === 'cancelada' && estadoAnterior !== 'cancelada'
            ? 'Orden cancelada y stock devuelto al catálogo'
            : 'Estado de orden actualizado',
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
          
          const talla = item.talla || product.tallas?.[0] || 'Única';
          const availableStock = getAvailableStock(product, product.tallas?.length ? talla : null);

          if (availableStock < item.cantidad) {
            const tallaLabel = product.tallas?.length ? ` (talla ${talla})` : '';
            return res.status(400).json({ 
              message: `Stock insuficiente para ${product.nombre}${tallaLabel}. Disponible: ${availableStock}` 
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
        await incrementProductStock(
          Product,
          item.producto,
          item.cantidad,
          item.talla
        );
      }
      
      await order.deleteOne();
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  retrySiigoInvoice: async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'ID de orden inválido' });
      }

      const order = await Order.findById(req.params.id);
      if (!order) {
        return res.status(404).json({ message: 'Orden no encontrada' });
      }

      if (order.estado === 'cancelada') {
        return res.status(400).json({ message: 'No se puede facturar una orden cancelada' });
      }

      await emitirFacturaSiigo(order);

      if (order.siigoFactura?.estado === 'emitida') {
        return res.json({
          message: 'Factura electrónica emitida en Siigo',
          order,
        });
      }

      return res.status(502).json({
        message: order.siigoFactura?.error || 'No se pudo emitir la factura en Siigo',
        order,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = orderController; 