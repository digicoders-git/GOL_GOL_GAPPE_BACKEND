import express from 'express';
import { getAllOffers, getActiveOffers, createOffer, updateOffer, deleteOffer, validateOffer, applyOffer } from '../controllers/offerController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.get('/active', getActiveOffers);
router.post('/validate', validateOffer);
router.post('/apply', auth, applyOffer);
router.get('/', auth, getAllOffers);
router.post('/', auth, createOffer);
router.put('/:id', auth, updateOffer);
router.delete('/:id', auth, deleteOffer);

export default router;
