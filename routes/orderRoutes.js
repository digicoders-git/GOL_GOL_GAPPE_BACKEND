import express from 'express';
import {
  createOrder,
  getMyOrders,
  getAllOrders,
  assignKitchenToOrder,
  updateOrderStatus,
  deleteOrder
} from '../controllers/orderController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.use(auth);

router.post('/', createOrder);
router.get('/my-orders', getMyOrders);
router.get('/', getAllOrders);
router.put('/:id/assign-kitchen', assignKitchenToOrder);
router.patch('/:id/status', updateOrderStatus);
router.delete('/:id', deleteOrder);

export default router;
