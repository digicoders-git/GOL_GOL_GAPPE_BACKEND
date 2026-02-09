import express from 'express';
import { getAllUsers, getAdmins, deleteUser } from '../controllers/userController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.get('/users', auth, getAllUsers);
router.get('/admins', auth, getAdmins);
router.delete('/users/:id', auth, deleteUser);

export default router;
