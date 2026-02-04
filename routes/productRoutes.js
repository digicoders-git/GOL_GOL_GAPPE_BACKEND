import express from 'express';
import {
  getAllProducts,
  createProduct,
  updateProduct,
  addQuantity,
  getStockLogs
} from '../controllers/productController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.use(auth);

router.get('/', getAllProducts);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.post('/add-quantity', addQuantity);
router.get('/stock-logs', getStockLogs);

export default router;