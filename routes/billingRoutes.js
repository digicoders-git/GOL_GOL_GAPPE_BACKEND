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

router.get('/test-kitchen', testKitchenAssignment);
router.get('/my-orders', getUserOrders);
router.get('/kitchen-orders', getKitchenOrders);
router.post('/', createBill);
router.get('/', getAllBills);
router.get('/:id/print', getPrintBill);
router.get('/:id', getBillById);
router.put('/:id', updateBill);
router.patch('/:id/status', updateBillStatus);
router.delete('/:id', deleteBill);

export default router;