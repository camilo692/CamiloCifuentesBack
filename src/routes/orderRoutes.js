const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const auth = require('../middlewares/auth');
const roleAuth = require('../middlewares/roleAuth');

router.post('/', orderController.createOrder);

router.use(auth, roleAuth(['admin']));

router.get('/', orderController.getAllOrders);
router.get('/cliente/:email', orderController.getOrdersByEmail);
router.get('/:id', orderController.getOrderById);
router.put('/:id/status', orderController.updateOrderStatus);
router.put('/:id', orderController.updateOrder);
router.delete('/:id', orderController.deleteOrder);

module.exports = router;
