const Order = require('../models/Order');
const Product = require('../models/Product');

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
        .select('cliente total estado fechaCreacion');

      const totalProductos = await Product.countDocuments({ activo: true });

      res.json({
        totalVentas,
        totalPedidos,
        ventasMes,
        porEstado,
        topProductos,
        pedidosRecientes,
        totalProductos
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = adminController;
