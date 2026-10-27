const crypto = require('crypto');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const {
  getAvailableStock,
  decrementProductStock,
  incrementProductStock,
} = require('../utils/productStock');
const { isPaymentsQueueEnabled } = require('../config/queue');
const { enqueuePaymentJob } = require('../services/paymentsQueue');
const { emitirFacturaSiigo } = require('../services/orderSiigo');
const { isWompiEnabled } = require('../config/wompi');
const { buildWompiCheckout } = require('../services/wompiService');
const {
  STOCK_RESERVE_MINUTES,
  reservationDeadline,
  expireStaleReservationsSafe,
  restoreOrderStock,
} = require('../services/stockReservation');

const orderController = {
  // Crear nueva orden
  createOrder: async (req, res) => {
    try {
      await expireStaleReservationsSafe();
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

      const wompiEnabled = isWompiEnabled();
      const queueEnabled = !wompiEnabled && isPaymentsQueueEnabled();
      const metodo = wompiEnabled ? 'wompi' : metodoPago;
      let savedOrder;
      try {
        const order = new Order({
          cliente,
          direccion,
          productos: productosCompletos,
          subtotal,
          envio,
          total,
          metodoPago: metodo,
          notas,
          pago: wompiEnabled
            ? { estado: 'en_cola', proveedor: 'wompi' }
            : queueEnabled
            ? { estado: 'en_cola', proveedor: process.env.PAYMENT_PROVIDER || 'none' }
            : {
                estado: 'omitido',
                proveedor: 'none',
                ultimoError: 'Cola de pagos desactivada. No se cobró tarjeta.',
              },
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

      async function rollbackReservas() {
        for (const reserva of reservas) {
          await incrementProductStock(
            Product,
            reserva.producto,
            reserva.cantidad,
            reserva.talla
          );
        }
      }

      if (wompiEnabled) {
        const wompi = buildWompiCheckout(savedOrder);
        const checkoutToken = crypto.randomBytes(32).toString('hex');
        savedOrder.pago.reference = wompi.reference;
        savedOrder.pago.amountInCents = wompi.amountInCents;
        savedOrder.pago.reservadoHasta = reservationDeadline();
        savedOrder.pago.checkoutToken = checkoutToken;
        await savedOrder.save();

        const orderJson = savedOrder.toObject();
        if (orderJson.pago) {
          delete orderJson.pago.checkoutToken;
        }

        return res.status(201).json({
          message: 'Orden creada. Completa el pago con Wompi.',
          order: orderJson,
          wompi: {
            ...wompi,
            reservadoHasta: savedOrder.pago.reservadoHasta,
            minutosReserva: STOCK_RESERVE_MINUTES,
            checkoutToken,
          },
        });
      }

      if (queueEnabled) {
        try {
          await enqueuePaymentJob(savedOrder._id);
        } catch (error) {
          await rollbackReservas();
          await savedOrder.deleteOne();
          return res.status(503).json({
            message:
              'No se pudo encolar el pago. No se realizó el pedido. Intenta de nuevo en unos minutos.',
          });
        }

        return res.status(201).json({
          message: 'Orden creada. El pago quedó en cola para procesarse.',
          order: savedOrder,
        });
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

  abandonCheckout: async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Orden inválida' });
      }

      const order = await Order.findById(req.params.id).select('+pago.checkoutToken');
      if (!order) {
        return res.status(404).json({ message: 'Orden no encontrada' });
      }
      if (order.pago?.estado === 'completado') {
        return res.status(409).json({ message: 'Este pedido ya fue pagado.' });
      }

      const expected = String(order.pago?.checkoutToken || '');
      const provided = String(req.body?.token || '');
      const expectedBuf = Buffer.from(expected);
      const providedBuf = Buffer.from(provided);
      const tokenOk =
        expectedBuf.length > 0 &&
        expectedBuf.length === providedBuf.length &&
        crypto.timingSafeEqual(expectedBuf, providedBuf);
      if (!tokenOk) {
        return res.status(403).json({ message: 'No se pudo liberar esta reserva.' });
      }

      await restoreOrderStock(order);
      order.pago.estado = 'fallido';
      order.pago.ultimoError = 'reserva_expirada';
      if (order.estado === 'pendiente') {
        order.estado = 'cancelada';
      }
      await order.save();
      return res.json({ expired: true, minutosReserva: STOCK_RESERVE_MINUTES });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  },

  lookupOrder: async (req, res) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const referencia = String(req.body.referencia || '')
        .trim()
        .replace(/\s/g, '')
        .toUpperCase();

      if (!email || referencia.length < 6) {
        return res.status(400).json({
          message: 'Escribe el correo del pedido y el número de orden.',
        });
      }

      const orders = await Order.find({ 'cliente.email': email })
        .sort({ fechaCreacion: -1 })
        .limit(40);

      const order = orders.find((item) => {
        const id = String(item._id).toUpperCase();
        return id === referencia || id.slice(-8) === referencia.slice(-8);
      });

      if (!order) {
        return res.status(404).json({
          message: 'No encontramos un pedido con esos datos.',
        });
      }

      const estadoPago = {
        en_cola: 'En proceso',
        procesando: 'En proceso',
        completado: 'Pagado',
        fallido: 'Pago fallido',
        omitido: 'Pendiente',
      };

      const estadoPedido = {
        pendiente: 'Pendiente',
        confirmada: 'Confirmado',
        enviada: 'Enviado',
        entregada: 'Entregado',
        cancelada: 'Cancelado',
      };

      return res.json({
        referencia: String(order._id).slice(-8).toUpperCase(),
        estado: estadoPedido[order.estado] || order.estado,
        pago: estadoPago[order.pago?.estado] || order.pago?.estado || 'Pendiente',
        fecha: order.fechaCreacion,
        subtotal: order.subtotal,
        envio: order.envio,
        total: order.total,
        numeroGuia: order.numeroGuia || '',
        ciudad: order.direccion?.ciudad || '',
        productos: order.productos.map((item) => ({
          nombre: item.nombre,
          cantidad: item.cantidad,
          talla: item.talla,
          precio: item.precio,
        })),
      });
    } catch (error) {
      return res.status(500).json({ message: error.message });
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