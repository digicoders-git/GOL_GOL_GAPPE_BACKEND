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
  getAvailableProducts,
  uploadImage
} from '../controllers/productController.js';
import auth from '../middleware/auth.js';
import { cacheMiddleware } from '../middleware/cache.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// Debug middleware
// router.use((req, res, next) => {
//   console.log(`=== PRODUCT ROUTE: ${req.method} ${req.path} ===`);
//   console.log('Headers:', req.headers);
//   console.log('Body:', req.body);
//   next();
// });

// Public route - NO CACHE for real-time kitchen stock updates
router.get('/available', getAvailableProducts);

router.use(auth);

// Cached routes
router.get('/', cacheMiddleware('all-products', 10000), getAllProducts);
router.get('/user-inventory', getUserInventory);
router.get('/transfer-history', getTransferHistory);
router.get('/stock-logs', getStockLogs);
router.delete('/stock-logs/:id', deleteStockLog);

// Action routes (MUST be before parameterized routes)
router.post('/upload-image', uploadImage);
router.post('/add-quantity', addQuantity);
router.post('/transfer', transferStock);

// Parameterized routes (MUST be last)
router.get('/:id', getProductById);
router.post('/', upload.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'images', maxCount: 5 }]), createProduct);
router.put('/:id', upload.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'images', maxCount: 5 }]), updateProduct);
router.delete('/:id', deleteProduct);

export default router;