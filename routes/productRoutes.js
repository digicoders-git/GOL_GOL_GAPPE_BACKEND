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
  getStockLogs,
  deleteStockLog,
  getAvailableProducts
} from '../controllers/productController.js';
import auth from '../middleware/auth.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = express.Router();

// Public route with cache
router.get('/available', cacheMiddleware('available-products', 15000), getAvailableProducts);

router.use(auth);

// Cached routes
router.get('/', cacheMiddleware('all-products', 10000), getAllProducts);
router.get('/user-inventory', getUserInventory);
router.get('/transfer-history', getTransferHistory);
router.get('/stock-logs', getStockLogs);
router.delete('/stock-logs/:id', deleteStockLog);

// Parameterized routes
router.get('/:id', getProductById);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

// Action routes
router.post('/add-quantity', addQuantity);
router.post('/transfer', transferStock);

export default router;