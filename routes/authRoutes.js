import express from 'express';
import { login, otpLogin, directLogin, directRegister, sendOtp, register, getProfile, changePassword, getAllUsers, deleteUser, updateProfile } from '../controllers/authController.js';
import { getAdminDashboard } from '../controllers/adminController.js';
import auth from '../middleware/auth.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = express.Router();

router.post('/login', login);
router.post('/otp-login', otpLogin);
router.post('/direct-login', directLogin);
router.post('/direct-register', directRegister);
router.post('/send-otp', sendOtp);
router.post('/register', auth, register);
router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.post('/change-password', auth, changePassword);
router.get('/users', auth, getAllUsers);
router.delete('/users/:id', auth, deleteUser);

// Dashboard route without cache to prevent unauthorized data leaking
router.get('/dashboard', auth, getAdminDashboard);

export default router;