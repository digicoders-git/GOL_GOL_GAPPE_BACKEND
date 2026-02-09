import express from 'express';
import { getMyKitchen, getMyKitchenOrders, getMyKitchenInventory } from '../controllers/billingAdminController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.get('/my-kitchen', auth, getMyKitchen);
router.get('/my-kitchen/orders', auth, getMyKitchenOrders);
router.get('/my-kitchen/inventory', auth, getMyKitchenInventory);

export default router;
