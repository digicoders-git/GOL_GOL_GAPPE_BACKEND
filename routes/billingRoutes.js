import express from 'express';
import {
  getAllBills,
  createBill,
  updateBill,
  updateBillStatus,
  getBillById,
  deleteBill,
  getKitchenOrders,
  getUserOrders,
  getPrintBill,
  testKitchenAssignment
} from '../controllers/billingController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.use(auth);

// Specific routes FIRST (before :id routes)
router.get('/test-kitchen', testKitchenAssignment);
router.get('/my-orders', getUserOrders);
router.get('/kitchen-orders', getKitchenOrders);

// Generic routes
router.post('/', createBill);
router.get('/', getAllBills);

// Routes with :id parameter - specific ones FIRST
router.get('/:id/print', getPrintBill);
router.patch('/:id/status', updateBillStatus);
router.put('/:id', updateBill);
router.delete('/:id', deleteBill);
router.get('/:id', getBillById);

export default router;
