import { Router } from 'express';
import {
  getCurrentProfile,
  createProfile,
  updateProfile,
  uploadAvatar,
  getPublicProfile,
} from '../controllers/profileController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Rutas que requieren autenticación
router.get('/me', authMiddleware, getCurrentProfile);
router.post('/me', authMiddleware, createProfile);
router.put('/me', authMiddleware, updateProfile);
router.post('/me/avatar', authMiddleware, uploadAvatar);

// Ruta pública
router.get('/:id', getPublicProfile);

export default router;

