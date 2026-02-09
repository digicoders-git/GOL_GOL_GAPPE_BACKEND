import express from 'express';
import {
  getAllProducts,
  getProductById,
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

// Static / specialized routes first to avoid being caught by /:id
router.get('/user-inventory', getUserInventory);
router.get('/transfer-history', getTransferHistory);
router.get('/stock-logs', getStockLogs);

// Parameterized routes last
router.get('/', getAllProducts);
router.get('/:id', getProductById);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

// Action routes
router.post('/add-quantity', addQuantity);
router.post('/transfer', transferStock);

export default router;