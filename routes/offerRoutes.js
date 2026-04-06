import express from 'express';
import { getAllOffers, getActiveOffers, getOfferById, createOffer, updateOffer, deleteOffer, validateOffer, applyOffer, applyOfferToProduct, removeAppliedOffer } from '../controllers/offerController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.get('/active', getActiveOffers);
router.post('/validate', auth, validateOffer);
router.post('/apply', auth, applyOffer);
router.post('/remove', auth, removeAppliedOffer);
router.post('/apply-product', auth, applyOfferToProduct);
router.get('/:id', auth, getOfferById);
router.get('/', auth, getAllOffers);
router.post('/', auth, createOffer);
router.put('/:id', auth, updateOffer);
router.delete('/:id', auth, deleteOffer);

export default router;
