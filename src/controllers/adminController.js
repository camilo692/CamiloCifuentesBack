const Order = require('../models/Order');
const Product = require('../models/Product');
const { getSiigoPublicStatus } = require('../config/siigo');

const adminController = {
  getStats: async (_req, res) => {
    try {
      const orders = await Order.find();
      const activeOrders = orders.filter((o) => o.estado !== 'cancelada');

      const totalVentas = activeOrders.reduce((sum, o) => sum + o.total, 0);
      const totalPedidos = activeOrders.length;

      const porEstado = {
        pendiente: 0,
        confirmada: 0,
        enviada: 0,
        entregada: 0,
        cancelada: 0
      };

      orders.forEach((o) => {
        porEstado[o.estado] = (porEstado[o.estado] || 0) + 1;
      });

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const ventasMes = activeOrders
        .filter((o) => new Date(o.fechaCreacion) >= startOfMonth)
        .reduce((sum, o) => sum + o.total, 0);

      const productosVendidos = {};
      activeOrders.forEach((order) => {
        order.productos.forEach((item) => {
          const key = item.nombre;
          productosVendidos[key] = (productosVendidos[key] || 0) + item.cantidad;
        });
      });

      const topProductos = Object.entries(productosVendidos)
        .map(([nombre, cantidad]) => ({ nombre, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 5);

      const pedidosRecientes = await Order.find()
        .sort({ fechaCreacion: -1 })
        .limit(5)
        .select('cliente total estado fechaCreacion siigoFactura');

      const totalProductos = await Product.countDocuments({ activo: true });

      const facturacionPorEstado = {
        emitida: 0,
        error: 0,
        omitida: 0,
        pendiente: 0,
      };

      orders.forEach((order) => {
        const estadoFactura = order.siigoFactura?.estado || 'pendiente';
        facturacionPorEstado[estadoFactura] = (facturacionPorEstado[estadoFactura] || 0) + 1;
      });

      const facturasEmitidas = orders.filter((o) => o.siigoFactura?.estado === 'emitida');
      const totalFacturado = facturasEmitidas.reduce((sum, o) => sum + (o.total || 0), 0);

      const facturasRecientes = await Order.find({ 'siigoFactura.estado': { $exists: true } })
        .sort({ fechaCreacion: -1 })
        .limit(8)
        .select('cliente total estado fechaCreacion siigoFactura');

      const facturasConError = await Order.find({ 'siigoFactura.estado': 'error' })
        .sort({ fechaActualizacion: -1 })
        .limit(8)
        .select('cliente total estado fechaCreacion siigoFactura');

      res.json({
        totalVentas,
        totalPedidos,
        ventasMes,
        porEstado,
        topProductos,
        pedidosRecientes,
        totalProductos,
        siigo: {
          ...getSiigoPublicStatus(),
          porEstado: facturacionPorEstado,
          totalFacturado,
          totalEmitidas: facturacionPorEstado.emitida,
          facturasRecientes,
          facturasConError,
        },
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = adminController;
