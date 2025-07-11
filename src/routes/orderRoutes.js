const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// Crear nueva orden
router.post('/', orderController.createOrder);

// Obtener todas las órdenes
router.get('/', orderController.getAllOrders);

// Obtener orden por ID
router.get('/:id', orderController.getOrderById);

// Obtener órdenes por email del cliente
router.get('/cliente/:email', orderController.getOrdersByEmail);

// Actualizar estado de la orden
router.put('/:id/status', orderController.updateOrderStatus);

// Actualizar orden completa
router.put('/:id', orderController.updateOrder);

// Eliminar orden
router.delete('/:id', orderController.deleteOrder);

module.exports = router; 