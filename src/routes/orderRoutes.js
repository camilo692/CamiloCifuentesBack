const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const auth = require('../middlewares/auth');
const roleAuth = require('../middlewares/roleAuth');
const requireStoreOrigin = require('../middlewares/requireStoreOrigin');
const {
  orderCreateLimiter,
  lookupLimiter,
  abandonLimiter,
} = require('../middlewares/rateLimits');

router.post('/', requireStoreOrigin, orderCreateLimiter, orderController.createOrder);
router.post('/lookup', requireStoreOrigin, lookupLimiter, orderController.lookupOrder);
router.post(
  '/:id/abandon',
  requireStoreOrigin,
  abandonLimiter,
  orderController.abandonCheckout
);

router.use(auth, roleAuth(['admin']));

router.get('/', orderController.getAllOrders);
router.get('/cliente/:email', orderController.getOrdersByEmail);
router.get('/:id', orderController.getOrderById);
router.put('/:id/status', orderController.updateOrderStatus);
router.post('/:id/siigo-invoice', orderController.retrySiigoInvoice);
router.put('/:id', orderController.updateOrder);
router.delete('/:id', orderController.deleteOrder);

module.exports = router;
