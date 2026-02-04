import express from 'express';
import { login, register, getProfile, changePassword } from '../controllers/authController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.get('/profile', auth, getProfile);
router.post('/change-password', auth, changePassword);

export default router;