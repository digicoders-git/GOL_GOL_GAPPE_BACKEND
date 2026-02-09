import express from 'express';
import {
  getAllKitchens,
  getKitchenInventory,
  createKitchen,
  updateKitchen,
  assignProduct,
  deleteKitchen
} from '../controllers/kitchenController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.use(auth);

router.get('/', getAllKitchens);
router.get('/:id/inventory', getKitchenInventory);
router.post('/', createKitchen);
router.put('/:id', updateKitchen);
router.post('/assign-product', assignProduct);
router.delete('/:id', deleteKitchen);

export default router;