import express from 'express';
import {
  getAllKitchens,
  createKitchen,
  updateKitchen,
  assignProduct,
  deleteKitchen
} from '../controllers/kitchenController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.use(auth);

router.get('/', getAllKitchens);
router.post('/', createKitchen);
router.put('/:id', updateKitchen);
router.post('/assign-product', assignProduct);
router.delete('/:id', deleteKitchen);

export default router;