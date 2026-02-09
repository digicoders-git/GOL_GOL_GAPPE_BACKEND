import express from 'express';
import { login, otpLogin, sendOtp, register, getProfile, changePassword, getAllUsers, deleteUser } from '../controllers/authController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.post('/otp-login', otpLogin);
router.post('/send-otp', sendOtp);
router.post('/register', auth, register);
router.get('/profile', auth, getProfile);
router.post('/change-password', auth, changePassword);
router.get('/users', auth, getAllUsers);
router.delete('/users/:id', auth, deleteUser);

export default router;