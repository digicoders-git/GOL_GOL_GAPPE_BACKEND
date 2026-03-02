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
  getPrintBill
} from '../controllers/billingController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.use(auth);

router.get('/', getAllBills);
router.get('/my-orders', getUserOrders);
router.get('/kitchen-orders', getKitchenOrders);
router.post('/', createBill);
router.get('/:id', getBillById);
router.get('/:id/print', getPrintBill);
router.put('/:id', updateBill);
router.patch('/:id/status', updateBillStatus);
router.delete('/:id', deleteBill);

export default router;