import express from 'express';
import {
  getAllBills,
  createBill,
  updateBill,
  getBillById,
  deleteBill
} from '../controllers/billingController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.use(auth);

router.get('/', getAllBills);
router.post('/', createBill);
router.get('/:id', getBillById);
router.put('/:id', updateBill);
router.delete('/:id', deleteBill);

export default router;