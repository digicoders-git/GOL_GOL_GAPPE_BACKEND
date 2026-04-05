import express from 'express';
import { getAllUsers, getAllAdmins, getAdmins, deleteUser, deleteAdmin, updateProfile } from '../controllers/userController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.get('/users', auth, getAllUsers);
router.get('/admins', auth, getAllAdmins);
router.delete('/users/:id', auth, deleteUser);
router.delete('/admins/:id', auth, deleteAdmin);
router.put('/profile', auth, updateProfile);

export default router;
