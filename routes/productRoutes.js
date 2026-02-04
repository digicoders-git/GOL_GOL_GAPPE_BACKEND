import express from 'express';
import {
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  addQuantity,
  transferStock,
  getUserInventory,
  getTransferHistory,
  getStockLogs
} from '../controllers/productController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.use(auth);

router.get('/', getAllProducts);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.post('/add-quantity', addQuantity);
router.post('/transfer', transferStock);
router.get('/user-inventory', getUserInventory);
router.get('/transfer-history', getTransferHistory);
router.get('/stock-logs', getStockLogs);

export default router;